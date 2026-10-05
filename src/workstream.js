// Create a workstream by cloning a template of the same channel, the way the admin center builds one:
// a routing contract (with the template's context variables), the workstream, its context variables
// and capacity profile links, and an active routing configuration with one queue-identification step
// and its route-to-queue ruleset. The channel itself (WhatsApp number, widget, phone number) is not
// copied: it belongs to the template and is connected afterwards in the admin center.
import { bind, relationships } from './pptb.js'
import { normGuid, parseRules } from './rules.js'
import { rulesetKind } from './edit.js'

const FV = '@OData.Community.Display.V1.FormattedValue'
const rows = (raw, key) => (Array.isArray(raw[key]) ? raw[key] : [])
const same = (a, b) => normGuid(a) === normGuid(b)
const hexId = () => crypto.randomUUID().replace(/-/g, '')

// ---------------------------------------------------------------- what gets copied

// Plain workstream settings copied from the template when it has them. Not copied: bot, API keys,
// record-routing links, counters and anything the platform maintains itself.
const SETTINGS = [
  'msdyn_streamsource', 'msdyn_mode', 'msdyn_workdistributionmode', 'msdyn_direction', 'msdyn_capacityformat', 'msdyn_capacityrequired',
  'msdyn_allowedpresences', 'msdyn_autocloseafterinactivity', 'msdyn_blockcapacityforwrapup', 'msdyn_enableagentaffinity',
  'msdyn_alwaysassigntolastagent', 'msdyn_assigntolastagentonlyforsamechat', 'msdyn_conversationmode', 'msdyn_screenpoptimeout_optionSet',
  'msdyn_enableselectingfrompushbasedworkstreams', 'msdyn_notification', 'msdyn_enableautomatedmessages', 'msdyn_restrictdownloadrecording',
  'msdyn_restrictdownloadtranscript', 'msdyn_requiredispositioncodeforworkstreamconversations', 'msdyn_useglobalsettingsforrequiringdispositioncode',
  'msdyn_isconversationcounterenabled', 'msdyn_matchinglogic', 'msdyn_handlingtimethreshold', 'msdyn_waitingtimethreshold', 'msdyn_followupafterwaiting',
  'msdyn_fallbacklanguage',
]
// Lookups copied as-is: default/outbound queue, session template and notification templates.
const LOOKUPS = /^_(msdyn_defaultqueue|msdyn_outboundqueueid|msdyn_sessiontemplate_default|msdyn_notificationtemplate_\w+)_value$/
const VARIABLE_FIELDS = ['msdyn_name', 'msdyn_displayname', 'msdyn_datatype', 'msdyn_ismodifiable', 'msdyn_isdisplayable', 'msdyn_islist', 'msdyn_relationshipname', 'msdyn_entitylogicalname']

// Workstreams that can serve as template: they have a routing contract (admin-center workstreams do).
export const templates = (raw) => rows(raw, 'workstreams').filter((w) => w._msdyn_routingcontractid_value)

// Everything that will be created, worked out from the snapshot; the preview shows exactly this.
export function planWorkstream(raw, templateId, { copyRules = true } = {}) {
  const ws = rows(raw, 'workstreams').find((w) => same(w.msdyn_liveworkstreamid, templateId))
  const uniqueOf = (id) => rows(raw, 'contracts').find((c) => same(c.msdyn_decisioncontractid, id))?.msdyn_uniquename
  const variables = rows(raw, 'contextVariables').filter((v) => same(v._msdyn_liveworkstreamid_value, templateId) && !v.msdyn_issystemdefined)
  const capacity = rows(raw, 'workstreamCapacity').filter((c) => same(c._msdyn_workstream_id_value, templateId))
  const config = rows(raw, 'routingConfigs').find((c) => same(c._msdyn_liveworkstreamid_value, templateId) && c.msdyn_isactiveconfiguration)
  const steps = config ? rows(raw, 'routingSteps').filter((s) => same(s._msdyn_routingconfigurationid_value, config.msdyn_routingconfigurationid)) : []
  const rulesetOf = (step) => rows(raw, 'rulesets').find((r) => same(r.msdyn_decisionrulesetid, step._msdyn_rulesetid_value))
  const kindOf = (r) => r && rulesetKind(uniqueOf(r._msdyn_outputcontractid_value), uniqueOf(r._msdyn_inputcontractid_value))
  const routeStep = steps.find((s) => kindOf(rulesetOf(s)) === 'route')
  const route = routeStep && rulesetOf(routeStep)
  const hitPolicy = /<decision[^>]*hit-policy="([^"]+)"/.exec(route?.msdyn_rulesetdefinition ?? '')?.[1] ?? 'all'
  return {
    template: ws,
    contractId: ws._msdyn_routingcontractid_value,
    variables,
    capacity,
    route: route && {
      step: routeStep,
      ruleset: route,
      definition: copyRules ? route.msdyn_rulesetdefinition : `<decision hit-policy="${hitPolicy}" version="1">\n  <rules />\n</decision>`,
      rules: copyRules ? parseRules(route.msdyn_rulesetdefinition).length : 0,
    },
    skippedSteps: steps.filter((s) => s !== routeStep).length, // e.g. classification: not copied
  }
}

// ---------------------------------------------------------------- create / delete

// Creates every record in order. If one fails, the records already created are deleted (newest
// first) before the error is raised, so nothing is left half-built. Returns the created records,
// which `deleteCreated` removes again (undo).
export async function createWorkstream(name, plan) {
  const { template } = plan
  // read everything that can fail before writing anything
  const full = await dataverseAPI.retrieve('msdyn_liveworkstream', normGuid(template.msdyn_liveworkstreamid))
  const contract = await dataverseAPI.retrieve('msdyn_decisioncontract', normGuid(plan.contractId), ['msdyn_contractdefinition'])
  const settings = Object.fromEntries(SETTINGS.filter((f) => full[f] != null).map((f) => [f, full[f]]))
  const lookupBinds = []
  for (const [key, id] of Object.entries(full)) {
    const m = LOOKUPS.exec(key)
    if (m && id) lookupBinds.push(await bind('msdyn_liveworkstream', m[1], id))
  }
  for (const entity of ['msdyn_liveworkstream', 'msdyn_ocliveworkstreamcontextvariable', 'msdyn_liveworkstreamcapacityprofile', 'msdyn_decisionruleset', 'msdyn_routingconfiguration', 'msdyn_routingconfigurationstep'])
    await relationships(entity)

  const created = []
  const make = async (entity, record) => {
    const { id } = await dataverseAPI.create(entity, record)
    created.push({ entity, id })
    return id
  }
  try {
    const unique = 'new_' + crypto.randomUUID().replace(/-/g, '_')
    const contractId = await make('msdyn_decisioncontract', { msdyn_name: unique, msdyn_uniquename: unique, msdyn_contractdefinition: contract.msdyn_contractdefinition })
    const wsId = await make('msdyn_liveworkstream', {
      ...settings,
      msdyn_name: name,
      ...Object.assign({}, ...lookupBinds),
      ...(await bind('msdyn_liveworkstream', 'msdyn_routingcontractid', contractId)),
    })
    const toWs = await bind('msdyn_ocliveworkstreamcontextvariable', 'msdyn_liveworkstreamid', wsId)
    for (const v of plan.variables)
      await make('msdyn_ocliveworkstreamcontextvariable', { ...Object.fromEntries(VARIABLE_FIELDS.filter((f) => v[f] != null).map((f) => [f, v[f]])), msdyn_issystemdefined: false, ...toWs })
    for (const c of plan.capacity)
      await make('msdyn_liveworkstreamcapacityprofile', {
        msdyn_name: name,
        ...(await bind('msdyn_liveworkstreamcapacityprofile', 'msdyn_workstream_id', wsId)),
        ...(await bind('msdyn_liveworkstreamcapacityprofile', 'msdyn_capacityprofile_id', c._msdyn_capacityprofile_id_value)),
      })
    if (plan.route) {
      const { ruleset, step, definition } = plan.route
      const rulesetId = await make('msdyn_decisionruleset', {
        msdyn_name: name, msdyn_uniquename: `new_${hexId()}`,
        msdyn_rulesettype: ruleset.msdyn_rulesettype, msdyn_authoringmode: ruleset.msdyn_authoringmode, msdyn_rulesetdefinition: definition,
        ...(await bind('msdyn_decisionruleset', 'msdyn_inputcontractid', contractId)),
        ...(await bind('msdyn_decisionruleset', 'msdyn_outputcontractid', ruleset._msdyn_outputcontractid_value)),
      })
      const configId = await make('msdyn_routingconfiguration', {
        msdyn_name: name, msdyn_uniquename: `new_${hexId()}`, msdyn_isactiveconfiguration: true,
        ...(await bind('msdyn_routingconfiguration', 'msdyn_liveworkstreamid', wsId)),
      })
      await make('msdyn_routingconfigurationstep', {
        msdyn_name: name, msdyn_uniquename: `new_${hexId()}`, msdyn_steporder: 1, msdyn_type: step.msdyn_type,
        ...(await bind('msdyn_routingconfigurationstep', 'msdyn_routingconfigurationid', configId)),
        ...(await bind('msdyn_routingconfigurationstep', 'msdyn_rulesetid', rulesetId)),
      })
    }
    return { workstreamId: wsId, created }
  } catch (e) {
    const leftovers = await deleteCreated(created)
    throw Object.assign(e, { code: leftovers.length ? 'partial' : 'rolledBack', leftovers })
  }
}

// Deletes created records newest first; returns the ones that could not be deleted.
export async function deleteCreated(created) {
  const leftovers = []
  for (const record of [...created].reverse()) {
    try {
      await dataverseAPI.delete(record.entity, record.id)
    } catch {
      leftovers.push(record)
    }
  }
  return leftovers
}

// Tables re-read after creating or deleting a workstream.
export const WORKSTREAM_TABLES = ['workstreams', 'contracts', 'contextVariables', 'workstreamCapacity', 'rulesets', 'routingConfigs', 'routingSteps']

// label of an option-set value as Dataverse formatted it
export const formatted = (row, field) => row?.[field + FV] ?? row?.[field]
