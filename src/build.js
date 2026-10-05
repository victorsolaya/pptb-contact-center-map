// Raw Web API rows (see public/background.js QUERIES) -> { meta, nodes, edges }.
import { parseRules, normGuid, simplify } from './rules.js'
import { rulesetKind } from './edit.js'
import { LANGS } from './i18n.js'

const fv = (r, f) => r[`${f}@OData.Community.Display.V1.FormattedValue`] ?? r[f]
const rows = (raw, k) => (Array.isArray(raw[k]) ? raw[k] : [])

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
  const F = t.fields
  const nodes = new Map()
  const edges = []
  const key = (type, guid) => `${type}:${normGuid(guid)}`
  const node = (type, guid, label, sub, data = {}) => {
    const k = key(type, guid)
    if (!nodes.has(k)) nodes.set(k, { id: k, type, label: label || t.text.noName, sub, data })
    return k
  }
  const edge = (source, target, kind, label = t.edges[kind]) => {
    if (nodes.has(source) && nodes.has(target)) edges.push({ source, target, kind, label: typeof label === 'string' ? label : undefined })
  }

  // --- nodes
  for (const q of rows(raw, 'queues'))
    node('queue', q.queueid, q.name, `${fv(q, 'msdyn_queuetype')} · ${fv(q, 'msdyn_assignmentstrategy')}`, {
      [F.type]: fv(q, 'msdyn_queuetype'),
      [F.assignmentMethod]: fv(q, 'msdyn_assignmentstrategy'),
      [F.priority]: q.msdyn_priority,
      [F.isDefault]: fv(q, 'msdyn_isdefaultqueue'),
      [F.hours]: fv(q, '_msdyn_operatinghourid_value'),
    })
  for (const u of rows(raw, 'users'))
    node('user', u.systemuserid, u.fullname, u.internalemailaddress, { [F.email]: u.internalemailaddress, [F.status]: fv(u, 'isdisabled') })
  for (const h of rows(raw, 'operatingHours')) node('hours', h.msdyn_operatinghourid, h.msdyn_name)
  // overflowactiondata holds the target: a queue GUID ("Transferir a una cola") or a phone number
  const queueName = (guid) => nodes.get(key('queue', guid))?.label
  for (const o of rows(raw, 'overflowActions')) {
    const target = queueName(o.msdyn_overflowactiondata) ?? o.msdyn_overflowactiondata
    node('overflow', o.msdyn_overflowactionconfigid, fv(o, 'msdyn_overflowactiontype'), target, { [F.action]: fv(o, 'msdyn_overflowactiontype'), [F.target]: target, [F.name]: o.msdyn_name })
  }
  for (const c of rows(raw, 'capacityProfiles'))
    node('capacity', c.msdyn_capacityprofileid, c.msdyn_name, t.text.max(c.msdyn_defaultmaxunits), { [F.maxUnits]: c.msdyn_defaultmaxunits, [F.blockAssignment]: fv(c, 'msdyn_blockassignment') })
  for (const w of rows(raw, 'workstreams'))
    node('workstream', w.msdyn_liveworkstreamid, w.msdyn_name, `${fv(w, 'msdyn_streamsource')} · ${fv(w, 'msdyn_workdistributionmode')}${w.statecode ? ` · ${t.text.inactive}` : ''}`, {
      [F.channel]: fv(w, 'msdyn_streamsource'),
      [F.distribution]: fv(w, 'msdyn_workdistributionmode'),
      [F.mode]: fv(w, 'msdyn_mode'),
      [F.direction]: fv(w, 'msdyn_direction'),
      [F.capacityRequired]: `${w.msdyn_capacityrequired} (${fv(w, 'msdyn_capacityformat')})`,
      [F.defaultQueue]: fv(w, '_msdyn_defaultqueue_value'),
      [F.bot]: fv(w, '_msdyn_bot_user_value'),
      [F.status]: fv(w, 'statecode'),
    })
  for (const [k, table, nameCol] of CHANNELS)
    for (const c of rows(raw, k))
      node('channel', c[table + 'id'], c[nameCol], [t.channels[k], fv(c, '_msdyn_phonenumberid_value') ?? c.msdyn_organizationphonenumber].filter(Boolean).join(' · '), {
        [F.channel]: t.channels[k],
        [F.phone]: fv(c, '_msdyn_phonenumberid_value') ?? c.msdyn_organizationphonenumber,
        [F.workstream]: fv(c, '_msdyn_liveworkstreamid_value'),
      })

  // Rulesets and their rules. Rule actions point at queues / overflow actions by GUID inside the XML.
  const nameOf = (type, guid) => nodes.get(key(type, guid))?.label
  const contractName = new Map(rows(raw, 'contracts').map((c) => [normGuid(c.msdyn_decisioncontractid), c.msdyn_uniquename]))
  const ruleTargets = []
  for (const rs of rows(raw, 'rulesets')) {
    const rsId = node('ruleset', rs.msdyn_decisionrulesetid, rs.msdyn_name, `${fv(rs, 'msdyn_rulesettype')} · ${fv(rs, 'msdyn_authoringmode')}`, {
      [F.uniqueName]: rs.msdyn_uniquename,
      [F.type]: fv(rs, 'msdyn_rulesettype'),
      [F.authoring]: fv(rs, 'msdyn_authoringmode'),
      [F.description]: rs.msdyn_description,
    })
    // what the edit mode needs: which kind of ruleset (route / classification / not editable), its XML and contracts
    Object.assign(nodes.get(rsId), {
      kind: rulesetKind(contractName.get(normGuid(rs._msdyn_outputcontractid_value)), contractName.get(normGuid(rs._msdyn_inputcontractid_value))),
      guid: normGuid(rs.msdyn_decisionrulesetid),
      xml: rs.msdyn_rulesetdefinition ?? '',
      inputContract: normGuid(rs._msdyn_inputcontractid_value),
      outputContract: normGuid(rs._msdyn_outputcontractid_value),
    })
    parseRules(rs.msdyn_rulesetdefinition).forEach((r, i) => {
      const actions = r.set.map(({ attr, value }) =>
        attr === 'assign_to.queue' ? `${t.text.queueArrow} ${nameOf('queue', value) ?? value}`
        : attr?.startsWith('overflowaction.') ? `${t.text.overflowArrow} ${nameOf('overflow', value) ?? value}`
        : `${attr} = ${value}`)
      const ruleId = node('rule', `${rs.msdyn_decisionrulesetid}-${r.id}`, r.name, simplify(r.when, t) || r.orderBy.join(', ') || t.text.always, {
        [F.condition]: r.when || `(${t.text.always})`,
        [F.actions]: actions.join('\n'),
        [F.orderBy]: r.orderBy.join(', '),
      })
      Object.assign(nodes.get(ruleId), { rulesetId: rsId, ruleId: r.id })
      edge(rsId, ruleId, 'order', `#${i + 1}`)
      for (const { attr, value } of r.set) {
        if (attr === 'assign_to.queue') ruleTargets.push([ruleId, 'queue', value])
        else if (attr?.startsWith('overflowaction.')) ruleTargets.push([ruleId, 'overflow', value])
      }
    })
  }

  // --- edges
  for (const [ruleId, type, guid] of ruleTargets) {
    if (type === 'queue' && !nodes.has(key('queue', guid))) node('queue', guid, `${t.text.queue} ${normGuid(guid).slice(0, 8)}…`, t.text.queueNotFound)
    edge(ruleId, key(type, guid), 'route', null)
  }
  for (const o of rows(raw, 'overflowActions'))
    edge(key('overflow', o.msdyn_overflowactionconfigid), key('queue', o.msdyn_overflowactiondata), 'transfer')
  for (const [k, table] of CHANNELS)
    for (const c of rows(raw, k)) {
      edge(key('channel', c[table + 'id']), key('workstream', c._msdyn_liveworkstreamid_value), 'channel', null)
      if (c._msdyn_operatinghoursid_value) edge(key('channel', c[table + 'id']), key('hours', c._msdyn_operatinghoursid_value), 'hours')
    }
  for (const w of rows(raw, 'workstreams')) {
    const ws = key('workstream', w.msdyn_liveworkstreamid)
    if (w._msdyn_defaultqueue_value) edge(ws, key('queue', w._msdyn_defaultqueue_value), 'defaultQueue')
    if (w._msdyn_bot_user_value) edge(ws, node('user', w._msdyn_bot_user_value, fv(w, '_msdyn_bot_user_value'), t.text.bot), 'bot')
  }
  for (const wc of rows(raw, 'workstreamCapacity'))
    edge(key('workstream', wc._msdyn_workstream_id_value), key('capacity', wc._msdyn_capacityprofile_id_value), 'capacity')

  const activeRouting = new Map(rows(raw, 'routingConfigs').filter((c) => c.msdyn_isactiveconfiguration).map((c) => [c.msdyn_routingconfigurationid, c._msdyn_liveworkstreamid_value]))
  for (const s of rows(raw, 'routingSteps').sort((a, b) => a.msdyn_steporder - b.msdyn_steporder)) {
    const ws = activeRouting.get(s._msdyn_routingconfigurationid_value)
    if (ws) edge(key('workstream', ws), key('ruleset', s._msdyn_rulesetid_value), 'step', t.edges.step(s.msdyn_steporder))
  }

  for (const q of rows(raw, 'queues')) {
    const qid = key('queue', q.queueid)
    if (q._msdyn_operatinghourid_value) edge(qid, key('hours', q._msdyn_operatinghourid_value), 'hours')
    if (q._msdyn_prequeueoverflowrulesetid_value) edge(qid, key('ruleset', q._msdyn_prequeueoverflowrulesetid_value), 'pre')
    if (q._msdyn_inqueueoverflowrulesetid_value) edge(qid, key('ruleset', q._msdyn_inqueueoverflowrulesetid_value), 'in')
  }
  const activeAssignment = new Map(rows(raw, 'assignmentConfigs').filter((c) => c.msdyn_isactiveconfiguration).map((c) => [c.msdyn_assignmentconfigurationid, c._msdyn_queueid_value]))
  for (const s of rows(raw, 'assignmentSteps')) {
    const q = activeAssignment.get(s._msdyn_assignmentconfigurationid_value)
    if (q) edge(key('queue', q), key('ruleset', s._msdyn_rulesetid_value), 'assignment')
  }
  // queuememberships covers every queue (personal ones too); edge() drops non-omnichannel ones.
  for (const m of rows(raw, 'memberships')) edge(key('queue', m.queueid), key('user', m.systemuserid), 'member', null)

  const warnings = Object.entries(raw).filter(([, v]) => v?.error).map(([k, v]) => `${k}: ${v.error}`)
  return { meta: { org, extractedAt, warnings }, nodes: [...nodes.values()], edges }
}
