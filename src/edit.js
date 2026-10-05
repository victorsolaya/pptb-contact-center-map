// Write operations, one atomic and reversible Dataverse call each. They go through the PPTB host
// (dataverseAPI), so they run with the connection's own permissions.
import { fetchQuery } from './pptb.js'

const guid = (nodeId) => nodeId.split(':')[1]
const odataText = (s) => encodeURIComponent(s.trim().replace(/'/g, "''"))

// Enabled, human users matching name or email (application users excluded).
export async function searchUsers(text) {
  const v = odataText(text)
  if (!v) return []
  const rows = await fetchQuery(
    `systemusers?$select=fullname,internalemailaddress&$filter=isdisabled eq false and applicationid eq null and (contains(fullname,'${v}') or contains(internalemailaddress,'${v}'))&$orderby=fullname&$top=20`,
  )
  if (rows.error) throw new Error(rows.error)
  return rows.map((u) => ({ id: `user:${u.systemuserid}`, label: u.fullname, sub: u.internalemailaddress }))
}

// Same thing "Add users to queue" does in the admin center: queue <-> systemuser N:N.
export const addMember = (queueId, userId) => dataverseAPI.associate('queue', guid(queueId), 'queuemembership_association', 'systemuser', guid(userId))
export const removeMember = (queueId, userId) => dataverseAPI.disassociate('queue', guid(queueId), 'queuemembership_association', guid(userId))

// After a membership change only these two tables need re-reading.
export const MEMBER_TABLES = ['memberships', 'users']
