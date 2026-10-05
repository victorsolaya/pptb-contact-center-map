// Edit mode: changing the details of an existing workstream, queue or capacity profile. A change is a
// list of steps; each step writes one record and returns the function that reverts it. Plain field
// updates first check that Dataverse still holds what the map shows (nobody changed it meanwhile).
import { bind } from './pptb.js'
import { normGuid } from './rules.js'

const rows = (raw, key) => (Array.isArray(raw[key]) ? raw[key] : [])
const LINK = 'msdyn_liveworkstreamcapacityprofile'
const PROFILE = 'msdyn_capacityprofile'
// msdyn_capacityformat and msdyn_resetduration option values (the same in every org)
export const UNIT_BASED = 192350000
export const PROFILE_BASED = 192350001
const RESET_IMMEDIATELY = 192350000

// What can be edited per node type: plain columns, and lookups as { attribute: value column }.
// Not editable: a workstream's channel, work distribution mode and direction (fixed once created).
export const SPECS = {
  workstream: { entity: 'msdyn_liveworkstream', table: 'workstreams', id: 'msdyn_liveworkstreamid', fields: ['msdyn_name', 'msdyn_capacityformat', 'msdyn_capacityrequired'], lookups: { msdyn_defaultqueue: '_msdyn_defaultqueue_value' } },
  queue: { entity: 'queue', table: 'queues', id: 'queueid', fields: ['name', 'msdyn_priority'], lookups: { msdyn_operatinghourid: '_msdyn_operatinghourid_value' } },
  capacity: { entity: PROFILE, table: 'capacityProfiles', id: 'msdyn_capacityprofileid', fields: ['msdyn_name', 'msdyn_defaultmaxunits', 'msdyn_blockassignment'], lookups: {} },
}
// Tables re-read after saving each kind of record.
export const DETAIL_TABLES = { workstream: ['workstreams', 'workstreamCapacity', 'capacityProfiles'], queue: ['queues'], capacity: ['capacityProfiles'] }

const columns = (spec) => [...spec.fields, ...Object.values(spec.lookups)]
const value = (row, col) => (col.startsWith('_') ? normGuid(row?.[col]) : row?.[col]) ?? null
const differ = (a, b) => String(a ?? '') !== String(b ?? '')

export function recordOf(raw, node) {
  const spec = SPECS[node.type]
  return spec && !node.missing ? rows(raw, spec.table).find((r) => normGuid(r[spec.id]) === node.id.split(':')[1]) : undefined
}
export const linksOf = (raw, workstreamId) => rows(raw, 'workstreamCapacity').filter((l) => normGuid(l._msdyn_workstream_id_value) === workstreamId)
// how many workstreams use a capacity profile (the scope of editing it)
export const profileUse = (raw, profileId) => rows(raw, 'workstreamCapacity').filter((l) => normGuid(l._msdyn_capacityprofile_id_value) === profileId).length

// The form starts from the values the map shows.
export function initialForm(raw, node) {
  const spec = SPECS[node.type]
  const row = recordOf(raw, node)
  const form = Object.fromEntries(columns(spec).map((c) => [c, value(row, c)]))
  if (node.type === 'workstream') Object.assign(form, { profiles: linksOf(raw, normGuid(row[spec.id])).map((l) => normGuid(l._msdyn_capacityprofile_id_value)), newProfile: null })
  return form
}

// What will change and the steps that do it. Field updates go first: if the record changed
// meanwhile, nothing else is written.
export function planDetails(raw, node, form) {
  const spec = SPECS[node.type]
  const row = recordOf(raw, node)
  if (!row) return { changes: [], link: [], unlink: [], newProfile: null, steps: [] }
  const id = normGuid(row[spec.id])
  const changed = columns(spec).filter((c) => differ(value(row, c), form[c]))
  const before = Object.fromEntries(changed.map((c) => [c, value(row, c)]))
  const after = Object.fromEntries(changed.map((c) => [c, form[c] ?? null]))
  const steps = changed.length ? [updateStep(spec, id, before, after)] : []
  const plan = { changes: changed.map((c) => ({ col: c, from: before[c], to: after[c] })), link: [], unlink: [], newProfile: null, steps }
  // capacity profiles are only edited while the workstream is profile based
  if (node.type === 'workstream' && form.msdyn_capacityformat === PROFILE_BASED) {
    const links = linksOf(raw, id)
    const linked = links.map((l) => normGuid(l._msdyn_capacityprofile_id_value))
    plan.unlink = links.filter((l) => !form.profiles.includes(normGuid(l._msdyn_capacityprofile_id_value)))
    plan.link = form.profiles.filter((p) => !linked.includes(p))
    plan.newProfile = form.newProfile
    for (const l of plan.unlink) steps.push(unlinkStep(id, l, form.msdyn_name))
    if (form.newProfile) steps.push(createProfileStep(form.newProfile), linkStep(id, form.newProfile.id, form.msdyn_name))
    for (const p of plan.link) steps.push(linkStep(id, p, form.msdyn_name))
  }
  return plan
}

// ---------------------------------------------------------------- steps

const undoable = (label, fn) => Object.assign(fn, { label })

async function patch(spec, values) {
  const record = {}
  for (const [col, v] of Object.entries(values)) {
    const attr = Object.keys(spec.lookups).find((a) => spec.lookups[a] === col)
    Object.assign(record, attr ? await bind(spec.entity, attr, v) : { [col]: v })
  }
  return record
}
// Optimistic write: refuse if Dataverse no longer holds `expected` (e.g. edited in the admin center).
async function write(spec, id, expected, next) {
  const now = await dataverseAPI.retrieve(spec.entity, id, Object.keys(next))
  if (Object.keys(next).some((c) => differ(value(now, c), expected[c]))) throw Object.assign(new Error('stale'), { code: 'staleRecord' })
  await dataverseAPI.update(spec.entity, id, await patch(spec, next))
}
const updateStep = (spec, id, before, after) => async () => {
  await write(spec, id, before, after)
  return undoable(`${spec.entity} ${id}`, () => write(spec, id, after, before))
}

const linkStep = (workstreamId, profileId, name) => async () => {
  const { id } = await dataverseAPI.create(LINK, {
    msdyn_name: name,
    ...(await bind(LINK, 'msdyn_workstream_id', workstreamId)),
    ...(await bind(LINK, 'msdyn_capacityprofile_id', profileId)),
  })
  return undoable(`${LINK} ${id}`, () => dataverseAPI.delete(LINK, id))
}
const unlinkStep = (workstreamId, link, name) => async () => {
  await dataverseAPI.delete(LINK, link.msdyn_liveworkstreamcapacityprofileid)
  return undoable(`${LINK} ${normGuid(link._msdyn_capacityprofile_id_value)}`, () => linkStep(workstreamId, link._msdyn_capacityprofile_id_value, link.msdyn_name ?? name)())
}
// Same shape the admin center writes: unique name "new_<id>", reset immediately.
const createProfileStep = ({ id, name, units, block }) => async () => {
  await dataverseAPI.create(PROFILE, {
    msdyn_capacityprofileid: id, msdyn_uniquename: `new_${id}`, msdyn_name: name.trim(),
    msdyn_defaultmaxunits: units, msdyn_blockassignment: block, msdyn_resetduration: RESET_IMMEDIATELY,
  })
  return undoable(`${PROFILE} ${id}`, () => dataverseAPI.delete(PROFILE, id))
}

// Runs the steps in order. If one fails, the ones already done are reverted (newest first) before the
// error is raised. Returns the undo functions for `undoAll`.
export async function runSteps(steps) {
  const undos = []
  try {
    for (const step of steps) undos.push(await step())
  } catch (e) {
    if (!undos.length) throw e
    const leftovers = await undoAll(undos)
    throw Object.assign(e, { code: leftovers.length ? 'notReverted' : 'reverted', leftovers })
  }
  return undos
}
// Reverts newest first; returns the undos that failed, so a retry only redoes those.
export async function undoAll(undos) {
  const failed = []
  for (const undo of [...undos].reverse()) {
    try {
      await undo()
    } catch {
      failed.unshift(undo)
    }
  }
  return failed
}
