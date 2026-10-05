// Contact Center config read from the Dataverse Web API. Shared by the extension and the server.

export const QUERIES = {
  workstreams: 'msdyn_liveworkstreams?$select=msdyn_name,msdyn_streamsource,msdyn_mode,msdyn_direction,msdyn_workdistributionmode,msdyn_capacityrequired,msdyn_capacityformat,_msdyn_defaultqueue_value,_msdyn_bot_user_value,statecode',
  routingConfigs: 'msdyn_routingconfigurations?$select=msdyn_name,_msdyn_liveworkstreamid_value,msdyn_isactiveconfiguration',
  routingSteps: 'msdyn_routingconfigurationsteps?$select=msdyn_name,msdyn_steporder,_msdyn_routingconfigurationid_value,_msdyn_rulesetid_value',
  rulesets: 'msdyn_decisionrulesets?$select=msdyn_name,msdyn_uniquename,msdyn_rulesettype,msdyn_authoringmode,msdyn_rulesetdefinition,msdyn_description',
  assignmentConfigs: 'msdyn_assignmentconfigurations?$select=msdyn_name,_msdyn_queueid_value,msdyn_isactiveconfiguration',
  assignmentSteps: 'msdyn_assignmentconfigurationsteps?$select=msdyn_name,msdyn_steporder,msdyn_isdefaultruleset,_msdyn_assignmentconfigurationid_value,_msdyn_rulesetid_value',
  queues: 'queues?$select=name,msdyn_queuetype,msdyn_priority,msdyn_assignmentstrategy,msdyn_isdefaultqueue,_msdyn_operatinghourid_value,_msdyn_prequeueoverflowrulesetid_value,_msdyn_inqueueoverflowrulesetid_value&$filter=msdyn_isomnichannelqueue eq true',
  memberships: 'queuememberships?$select=queueid,systemuserid',
  users: 'systemusers?$select=fullname,internalemailaddress,isdisabled&$filter=queuemembership_association/any(q:q/msdyn_isomnichannelqueue eq true)',
  operatingHours: 'msdyn_operatinghours?$select=msdyn_name',
  overflowActions: 'msdyn_overflowactionconfigs?$select=msdyn_name,msdyn_overflowactiontype,msdyn_overflowactiondata',
  capacityProfiles: 'msdyn_capacityprofiles?$select=msdyn_name,msdyn_defaultmaxunits,msdyn_blockassignment',
  workstreamCapacity: 'msdyn_liveworkstreamcapacityprofiles?$select=_msdyn_workstream_id_value,_msdyn_capacityprofile_id_value',
  voice: 'msdyn_ocvoicechannelsettings?$select=msdyn_name,_msdyn_liveworkstreamid_value,_msdyn_phonenumberid_value,_msdyn_operatinghoursid_value',
  whatsapp: 'msdyn_ocwhatsappchannelnumbers?$select=msdyn_name,msdyn_organizationphonenumber,_msdyn_liveworkstreamid_value',
  chat: 'msdyn_livechatconfigs?$select=msdyn_name,_msdyn_liveworkstreamid_value',
  teams: 'msdyn_octeamschannelconfigs?$select=msdyn_name,_msdyn_liveworkstreamid_value',
  facebook: 'msdyn_ocfbpages?$select=msdyn_fbpagename,_msdyn_liveworkstreamid_value',
  sms: 'msdyn_ocsmschannelsettings?$select=msdyn_name,_msdyn_liveworkstreamid_value',
  custom: 'msdyn_occustommessagingchannels?$select=msdyn_name,_msdyn_liveworkstreamid_value',
}

// Runs inside the D365 tab (extension: base '' + session cookie) or on the server (base = org URL +
// bearer token), so it must be self-contained: no closures over this file.
export async function fetchAll(queries, base = '', auth = {}) {
  const headers = {
    ...auth,
    Accept: 'application/json',
    'OData-Version': '4.0',
    'OData-MaxVersion': '4.0',
    Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue",odata.maxpagesize=5000',
  }
  const out = {}
  await Promise.all(Object.entries(queries).map(async ([key, q]) => {
    try {
      const rows = []
      for (let url = base + '/api/data/v9.2/' + q; url; ) {
        const r = await fetch(url, { headers })
        if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`)
        const j = await r.json()
        rows.push(...j.value)
        url = j['@odata.nextLink']
      }
      out[key] = rows
    } catch (e) {
      out[key] = { error: String(e.message ?? e) }
    }
  }))
  return out
}
