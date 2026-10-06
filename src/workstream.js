// Create a workstream by cloning a template of the same channel, the way the admin center builds one:
// a routing contract (with the template's context variables), the workstream, its context variables
// and capacity profile links, and an active routing configuration with one queue-identification step
// and its route-to-queue ruleset. The channel itself (WhatsApp number, widget, phone number) is not
// copied: it belongs to the template and is connected afterwards in the admin center.
import { bind, relationships } from './pptb.js'
import { normGuid, parseRules } from './rules.js'
import { rulesetKind } from './edit.js'
import { rows } from './queries.js'

const sameGuid = (a, b) => normGuid(a) === normGuid(b)
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
  'msdyn_fallbacklanguage', 'msdyn_blockcapacityforwrapupinseconds', 'msdyn_screenpoptimeout',
]
// Session and notification templates are text columns holding the template's unique name.
const TEMPLATES = /^msdyn_(sessiontemplate|notificationtemplate)_\w+$/
// Lookups copied as-is: default and outbound queue.
const LOOKUPS = /^_(msdyn_defaultqueue|msdyn_outboundqueueid)_value$/
const VARIABLE_FIELDS = ['msdyn_name', 'msdyn_displayname', 'msdyn_datatype', 'msdyn_ismodifiable', 'msdyn_isdisplayable', 'msdyn_islist', 'msdyn_relationshipname', 'msdyn_entitylogicalname']

// Workstreams that can serve as template: they have a routing contract (admin-center workstreams do).
export const templates = (raw) => rows(raw, 'workstreams').filter((workstream) => workstream._msdyn_routingcontractid_value)

// Everything that will be created, worked out from the snapshot; the preview shows exactly this.
export function planWorkstream(raw, templateId, { copyRules = true } = {}) {
  const template = rows(raw, 'workstreams').find((workstream) => sameGuid(workstream.msdyn_liveworkstreamid, templateId))
  const uniqueOf = (id) => rows(raw, 'contracts').find((contract) => sameGuid(contract.msdyn_decisioncontractid, id))?.msdyn_uniquename
  const variables = rows(raw, 'contextVariables').filter((variable) => sameGuid(variable._msdyn_liveworkstreamid_value, templateId) && !variable.msdyn_issystemdefined)
  const capacity = rows(raw, 'workstreamCapacity').filter((link) => sameGuid(link._msdyn_workstream_id_value, templateId))
  const config = rows(raw, 'routingConfigs').find((routingConfig) => sameGuid(routingConfig._msdyn_liveworkstreamid_value, templateId) && routingConfig.msdyn_isactiveconfiguration)
  const steps = config ? rows(raw, 'routingSteps').filter((step) => sameGuid(step._msdyn_routingconfigurationid_value, config.msdyn_routingconfigurationid)) : []
  const rulesetOf = (step) => rows(raw, 'rulesets').find((ruleset) => sameGuid(ruleset.msdyn_decisionrulesetid, step._msdyn_rulesetid_value))
  const kindOf = (ruleset) => ruleset && rulesetKind(uniqueOf(ruleset._msdyn_outputcontractid_value), uniqueOf(ruleset._msdyn_inputcontractid_value))
  const routeStep = steps.find((step) => kindOf(rulesetOf(step)) === 'route')
  const route = routeStep && rulesetOf(routeStep)
  const hitPolicy = /<decision[^>]*hit-policy="([^"]+)"/.exec(route?.msdyn_rulesetdefinition ?? '')?.[1] ?? 'all'
  return {
    template,
    contractId: template._msdyn_routingcontractid_value,
    variables,
    capacity,
    route: route && {
      step: routeStep,
      ruleset: route,
      definition: copyRules ? route.msdyn_rulesetdefinition : `<decision hit-policy="${hitPolicy}" version="1">\n  <rules />\n</decision>`,
      rules: copyRules ? parseRules(route.msdyn_rulesetdefinition).length : 0,
    },
    skippedSteps: steps.filter((step) => kindOf(rulesetOf(step)) === 'classification').length, // classification steps are not copied
    unknownSteps: steps.filter((step) => step !== routeStep && kindOf(rulesetOf(step)) !== 'classification').length, // kind could not be read (e.g. contracts not readable)
  }
}

// ---------------------------------------------------------------- create / delete

// Creates every record in order. If one fails, the records already created are deleted (newest
// first) before the error is raised, so nothing is left half-built. Returns the created records,
// which `deleteCreated` removes again (undo).
export async function createWorkstream(name, plan) {
  const { template } = plan
  // read the template and the lookup metadata before writing; anything that still fails later is rolled back
  const fullTemplate = await dataverseAPI.retrieve('msdyn_liveworkstream', normGuid(template.msdyn_liveworkstreamid))
  const contract = await dataverseAPI.retrieve('msdyn_decisioncontract', normGuid(plan.contractId), ['msdyn_contractdefinition'])
  const settings = Object.fromEntries(Object.keys(fullTemplate).filter((field) => fullTemplate[field] != null && (SETTINGS.includes(field) || TEMPLATES.test(field))).map((field) => [field, fullTemplate[field]]))
  const lookupBinds = []
  for (const [key, id] of Object.entries(fullTemplate)) {
    const match = LOOKUPS.exec(key)
    if (match && id) lookupBinds.push(await bind('msdyn_liveworkstream', match[1], id))
  }
  for (const entity of ['msdyn_liveworkstream', 'msdyn_ocliveworkstreamcontextvariable', 'msdyn_liveworkstreamcapacityprofile', 'msdyn_decisionruleset', 'msdyn_routingconfiguration', 'msdyn_routingconfigurationstep'])
    await relationships(entity)

  const created = []
  const createRecord = async (entity, record) => {
    const { id } = await dataverseAPI.create(entity, record)
    created.push({ entity, id })
    return id
  }
  try {
    const uniqueName = 'new_' + crypto.randomUUID().replace(/-/g, '_')
    const contractId = await createRecord('msdyn_decisioncontract', { msdyn_name: uniqueName, msdyn_uniquename: uniqueName, msdyn_contractdefinition: contract.msdyn_contractdefinition })
    const workstreamId = await createRecord('msdyn_liveworkstream', {
      ...settings,
      msdyn_name: name,
      ...Object.assign({}, ...lookupBinds),
      ...(await bind('msdyn_liveworkstream', 'msdyn_routingcontractid', contractId)),
    })
    const workstreamBind = await bind('msdyn_ocliveworkstreamcontextvariable', 'msdyn_liveworkstreamid', workstreamId)
    for (const variable of plan.variables)
      await createRecord('msdyn_ocliveworkstreamcontextvariable', { ...Object.fromEntries(VARIABLE_FIELDS.filter((field) => variable[field] != null).map((field) => [field, variable[field]])), msdyn_issystemdefined: false, ...workstreamBind })
    for (const link of plan.capacity)
      await createRecord('msdyn_liveworkstreamcapacityprofile', {
        msdyn_name: name,
        ...(await bind('msdyn_liveworkstreamcapacityprofile', 'msdyn_workstream_id', workstreamId)),
        ...(await bind('msdyn_liveworkstreamcapacityprofile', 'msdyn_capacityprofile_id', link._msdyn_capacityprofile_id_value)),
      })
    if (plan.route) {
      const { ruleset, step, definition } = plan.route
      const rulesetId = await createRecord('msdyn_decisionruleset', {
        msdyn_name: name, msdyn_uniquename: `new_${hexId()}`,
        msdyn_rulesettype: ruleset.msdyn_rulesettype, msdyn_authoringmode: ruleset.msdyn_authoringmode, msdyn_rulesetdefinition: definition,
        ...(await bind('msdyn_decisionruleset', 'msdyn_inputcontractid', contractId)),
        ...(await bind('msdyn_decisionruleset', 'msdyn_outputcontractid', ruleset._msdyn_outputcontractid_value)),
      })
      const configId = await createRecord('msdyn_routingconfiguration', {
        msdyn_name: name, msdyn_uniquename: `new_${hexId()}`, msdyn_isactiveconfiguration: true,
        ...(await bind('msdyn_routingconfiguration', 'msdyn_liveworkstreamid', workstreamId)),
      })
      await createRecord('msdyn_routingconfigurationstep', {
        msdyn_name: name, msdyn_uniquename: `new_${hexId()}`, msdyn_steporder: 1, msdyn_type: step.msdyn_type,
        ...(await bind('msdyn_routingconfigurationstep', 'msdyn_routingconfigurationid', configId)),
        ...(await bind('msdyn_routingconfigurationstep', 'msdyn_rulesetid', rulesetId)),
      })
    }
    return { workstreamId, created }
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
