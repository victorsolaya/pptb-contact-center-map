// Turns the raw Web API rows (one entry per QUERIES key in queries.js) into { meta, nodes, edges }.
import { parseRules, normGuid, simplify } from './rules.js'
import { rulesetKind } from './edit.js'
import { PROFILE_BASED } from './details.js'
import { summarizeIdentification } from './identification.js'
import { LANGS } from './i18n.js'
import { rows, formatted } from './queries.js'

// [raw key (also the t.channels key), table logical name, name column]
const CHANNELS = [
  ['voice', 'msdyn_ocvoicechannelsetting', 'msdyn_name'],
  ['whatsapp', 'msdyn_ocwhatsappchannelnumber', 'msdyn_name'],
  ['chat', 'msdyn_livechatconfig', 'msdyn_name'],
  ['teams', 'msdyn_octeamschannelconfig', 'msdyn_name'],
  ['facebook', 'msdyn_ocfbpage', 'msdyn_fbpagename'],
  ['sms', 'msdyn_ocsmschannelsetting', 'msdyn_name'],
  ['custom', 'msdyn_occustommessagingchannel', 'msdyn_name'],
]

// Labels come from the dictionary `t`; edges also carry a language-independent `kind` for logic.
export function buildGraph({ org, extractedAt, raw }, t = LANGS.en) {
  const fields = t.fields
  const nodes = new Map()
  const edges = []
  const key = (type, guid) => `${type}:${normGuid(guid)}`
  const node = (type, guid, label, sub, data = {}) => {
    const nodeId = key(type, guid)
    if (!nodes.has(nodeId)) nodes.set(nodeId, { id: nodeId, type, label: label || t.text.noName, sub, data })
    return nodeId
  }
  const edge = (source, target, kind, label = t.edges[kind]) => {
    if (nodes.has(source) && nodes.has(target)) edges.push({ source, target, kind, label: typeof label === 'string' ? label : undefined })
  }

  // --- nodes
  for (const queue of rows(raw, 'queues'))
    node('queue', queue.queueid, queue.name, t.text.queueSub(formatted(queue, 'msdyn_queuetype'), formatted(queue, 'msdyn_assignmentstrategy')), {
      [fields.type]: formatted(queue, 'msdyn_queuetype'),
      [fields.assignmentMethod]: formatted(queue, 'msdyn_assignmentstrategy'),
      [fields.priority]: queue.msdyn_priority,
      [fields.isDefault]: formatted(queue, 'msdyn_isdefaultqueue'),
      [fields.hours]: formatted(queue, '_msdyn_operatinghourid_value'),
    })
  for (const user of rows(raw, 'users'))
    node('user', user.systemuserid, user.fullname, user.internalemailaddress, { [fields.email]: user.internalemailaddress, [fields.status]: formatted(user, 'isdisabled') })
  for (const schedule of rows(raw, 'operatingHours')) node('hours', schedule.msdyn_operatinghourid, schedule.msdyn_name)
  // overflowactiondata holds the target: a queue GUID ("Transfer to a queue") or a phone number
  const queueName = (guid) => nodes.get(key('queue', guid))?.label
  for (const overflow of rows(raw, 'overflowActions')) {
    const target = queueName(overflow.msdyn_overflowactiondata) ?? overflow.msdyn_overflowactiondata
    node('overflow', overflow.msdyn_overflowactionconfigid, formatted(overflow, 'msdyn_overflowactiontype'), target, { [fields.action]: formatted(overflow, 'msdyn_overflowactiontype'), [fields.target]: target, [fields.name]: overflow.msdyn_name })
  }
  for (const profile of rows(raw, 'capacityProfiles'))
    node('capacity', profile.msdyn_capacityprofileid, profile.msdyn_name, t.text.max(profile.msdyn_defaultmaxunits), { [fields.maxUnits]: profile.msdyn_defaultmaxunits, [fields.blockAssignment]: formatted(profile, 'msdyn_blockassignment') })
  // profile-based workstreams: the linked profiles say the capacity, the units column is unused
  const profilesOf = (workstreamGuid) => rows(raw, 'workstreamCapacity').filter((link) => normGuid(link._msdyn_workstream_id_value) === normGuid(workstreamGuid))
    .map((link) => nodes.get(key('capacity', link._msdyn_capacityprofile_id_value))?.label).filter(Boolean).join(', ')
  for (const workstream of rows(raw, 'workstreams'))
    node('workstream', workstream.msdyn_liveworkstreamid, workstream.msdyn_name, t.text.wsSub(formatted(workstream, 'msdyn_streamsource'), formatted(workstream, 'msdyn_workdistributionmode'), Boolean(workstream.statecode)), {
      [fields.channel]: formatted(workstream, 'msdyn_streamsource'),
      [fields.distribution]: formatted(workstream, 'msdyn_workdistributionmode'),
      [fields.mode]: formatted(workstream, 'msdyn_mode'),
      [fields.direction]: formatted(workstream, 'msdyn_direction'),
      [fields.capacityRequired]: workstream.msdyn_capacityformat === PROFILE_BASED
        ? [formatted(workstream, 'msdyn_capacityformat'), profilesOf(workstream.msdyn_liveworkstreamid)].filter(Boolean).join(': ')
        : `${workstream.msdyn_capacityrequired} (${formatted(workstream, 'msdyn_capacityformat')})`,
      [fields.defaultQueue]: formatted(workstream, '_msdyn_defaultqueue_value'),
      [fields.bot]: formatted(workstream, '_msdyn_bot_user_value'),
      [fields.status]: formatted(workstream, 'statecode'),
      [fields.identification]: summarizeIdentification(workstream.msdyn_recordidentificationrule, t) || t.text.identNoRules,
    })
  for (const [channelKey, table, nameCol] of CHANNELS)
    for (const channel of rows(raw, channelKey))
      node('channel', channel[table + 'id'], channel[nameCol], [t.channels[channelKey], formatted(channel, '_msdyn_phonenumberid_value') ?? channel.msdyn_organizationphonenumber].filter(Boolean).join('\n'), {
        [fields.channel]: t.channels[channelKey],
        [fields.phone]: formatted(channel, '_msdyn_phonenumberid_value') ?? channel.msdyn_organizationphonenumber,
        [fields.workstream]: formatted(channel, '_msdyn_liveworkstreamid_value'),
      })

  // Rulesets and their rules. Rule actions point at queues / overflow actions by GUID inside the XML.
  const nameOf = (type, guid) => nodes.get(key(type, guid))?.label
  const contractName = new Map(rows(raw, 'contracts').map((contract) => [normGuid(contract.msdyn_decisioncontractid), contract.msdyn_uniquename]))
  const ruleTargets = []
  for (const ruleset of rows(raw, 'rulesets')) {
    const kind = rulesetKind(contractName.get(normGuid(ruleset._msdyn_outputcontractid_value)), contractName.get(normGuid(ruleset._msdyn_inputcontractid_value)))
    const rulesetNodeId = node('ruleset', ruleset.msdyn_decisionrulesetid, ruleset.msdyn_name, t.text.kinds[kind] ?? formatted(ruleset, 'msdyn_rulesettype'), {
      [fields.uniqueName]: ruleset.msdyn_uniquename,
      [fields.type]: formatted(ruleset, 'msdyn_rulesettype'),
      [fields.authoring]: formatted(ruleset, 'msdyn_authoringmode'),
      [fields.description]: ruleset.msdyn_description,
    })
    // what the edit mode needs: which kind of ruleset (route / classification / not editable), its XML and contracts
    Object.assign(nodes.get(rulesetNodeId), {
      kind,
      guid: normGuid(ruleset.msdyn_decisionrulesetid),
      xml: ruleset.msdyn_rulesetdefinition ?? '',
      inputContract: normGuid(ruleset._msdyn_inputcontractid_value),
      outputContract: normGuid(ruleset._msdyn_outputcontractid_value),
    })
    parseRules(ruleset.msdyn_rulesetdefinition).forEach((rule, i) => {
      const actions = rule.set.map(({ attr, value, percentage }) =>
        attr === 'assign_to.queue' ? `${t.text.queueArrow} ${nameOf('queue', value) ?? value}${percentage ? ` (${percentage}%)` : ''}`
        : attr?.startsWith('overflowaction.') ? `${t.text.overflowArrow} ${nameOf('overflow', value) ?? value}`
        : `${attr} = ${value}`)
      const ruleNodeId = node('rule', `${ruleset.msdyn_decisionrulesetid}-${rule.id}`, rule.name, simplify(rule.when, t) || rule.orderBy.join(', ') || t.text.always, {
        [fields.condition]: rule.when || `(${t.text.always})`,
        [fields.actions]: actions.join('\n'),
        [fields.orderBy]: rule.orderBy.join(', '),
      })
      const sets = rule.set.filter(({ attr }) => attr && attr !== 'assign_to.queue' && !attr.startsWith('overflow'))
      Object.assign(nodes.get(ruleNodeId), { rulesetId: rulesetNodeId, ruleId: rule.id, sets: sets.map(({ attr, value }) => `${attr.replace(/^liveworkitemcontext\./, '')} = "${value}"`) })
      edge(rulesetNodeId, ruleNodeId, 'order', `#${i + 1}`)
      for (const { attr, value, percentage } of rule.set) {
        if (attr === 'assign_to.queue') ruleTargets.push([ruleNodeId, 'queue', value, percentage && `${percentage}%`])
        else if (attr?.startsWith('overflowaction.')) ruleTargets.push([ruleNodeId, 'overflow', value])
      }
    })
  }

  // --- edges
  for (const [ruleNodeId, type, guid, label = null] of ruleTargets) {
    if (type === 'queue' && !nodes.has(key('queue', guid))) nodes.get(node('queue', guid, `${t.text.queue} ${normGuid(guid).slice(0, 8)}…`, t.text.queueNotFound)).missing = true
    edge(ruleNodeId, key(type, guid), 'route', label)
  }
  for (const overflow of rows(raw, 'overflowActions'))
    edge(key('overflow', overflow.msdyn_overflowactionconfigid), key('queue', overflow.msdyn_overflowactiondata), 'transfer')
  for (const [channelKey, table] of CHANNELS)
    for (const channel of rows(raw, channelKey)) {
      edge(key('channel', channel[table + 'id']), key('workstream', channel._msdyn_liveworkstreamid_value), 'channel', null)
      if (channel._msdyn_operatinghoursid_value) edge(key('channel', channel[table + 'id']), key('hours', channel._msdyn_operatinghoursid_value), 'hours')
    }
  for (const workstream of rows(raw, 'workstreams')) {
    const workstreamNodeId = key('workstream', workstream.msdyn_liveworkstreamid)
    if (workstream._msdyn_defaultqueue_value) edge(workstreamNodeId, key('queue', workstream._msdyn_defaultqueue_value), 'defaultQueue')
    if (workstream._msdyn_bot_user_value) edge(workstreamNodeId, node('user', workstream._msdyn_bot_user_value, formatted(workstream, '_msdyn_bot_user_value'), t.text.bot), 'bot')
  }
  for (const link of rows(raw, 'workstreamCapacity'))
    edge(key('workstream', link._msdyn_workstream_id_value), key('capacity', link._msdyn_capacityprofile_id_value), 'capacity')

  const activeRouting = new Map(rows(raw, 'routingConfigs').filter((config) => config.msdyn_isactiveconfiguration).map((config) => [config.msdyn_routingconfigurationid, config._msdyn_liveworkstreamid_value]))
  for (const step of rows(raw, 'routingSteps').sort((a, b) => a.msdyn_steporder - b.msdyn_steporder)) {
    const workstreamId = activeRouting.get(step._msdyn_routingconfigurationid_value)
    if (workstreamId) edge(key('workstream', workstreamId), key('ruleset', step._msdyn_rulesetid_value), 'step', t.edges.step(step.msdyn_steporder))
  }

  for (const queue of rows(raw, 'queues')) {
    const queueNodeId = key('queue', queue.queueid)
    if (queue._msdyn_operatinghourid_value) edge(queueNodeId, key('hours', queue._msdyn_operatinghourid_value), 'hours')
    if (queue._msdyn_prequeueoverflowrulesetid_value) edge(queueNodeId, key('ruleset', queue._msdyn_prequeueoverflowrulesetid_value), 'pre')
    if (queue._msdyn_inqueueoverflowrulesetid_value) edge(queueNodeId, key('ruleset', queue._msdyn_inqueueoverflowrulesetid_value), 'in')
  }
  const activeAssignment = new Map(rows(raw, 'assignmentConfigs').filter((config) => config.msdyn_isactiveconfiguration).map((config) => [config.msdyn_assignmentconfigurationid, config._msdyn_queueid_value]))
  for (const step of rows(raw, 'assignmentSteps')) {
    const queueId = activeAssignment.get(step._msdyn_assignmentconfigurationid_value)
    if (queueId) edge(key('queue', queueId), key('ruleset', step._msdyn_rulesetid_value), 'assignment')
  }
  // queuememberships covers every queue (personal ones too); edge() drops non-omnichannel ones.
  for (const membership of rows(raw, 'memberships')) edge(key('queue', membership.queueid), key('user', membership.systemuserid), 'member', null)

  const warnings = Object.entries(raw).filter(([, v]) => v?.error).map(([k, v]) => `${k}: ${v.error}`)
  return { meta: { org, extractedAt, warnings }, nodes: [...nodes.values()], edges }
}
