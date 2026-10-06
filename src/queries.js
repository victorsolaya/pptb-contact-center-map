// Contact Center config read from the Dataverse Web API (OData paths, relative to /api/data/v9.2/).

export const QUERIES = {
  workstreams: 'msdyn_liveworkstreams?$select=msdyn_name,msdyn_streamsource,msdyn_mode,msdyn_direction,msdyn_workdistributionmode,msdyn_capacityrequired,msdyn_capacityformat,_msdyn_defaultqueue_value,_msdyn_bot_user_value,_msdyn_routingcontractid_value,msdyn_recordidentificationrule,statecode',
  routingConfigs: 'msdyn_routingconfigurations?$select=msdyn_name,_msdyn_liveworkstreamid_value,msdyn_isactiveconfiguration',
  routingSteps: 'msdyn_routingconfigurationsteps?$select=msdyn_name,msdyn_steporder,msdyn_type,_msdyn_routingconfigurationid_value,_msdyn_rulesetid_value',
  rulesets: 'msdyn_decisionrulesets?$select=msdyn_name,msdyn_uniquename,msdyn_rulesettype,msdyn_authoringmode,msdyn_rulesetdefinition,msdyn_description,_msdyn_inputcontractid_value,_msdyn_outputcontractid_value',
  contracts: 'msdyn_decisioncontracts?$select=msdyn_uniquename',
  contextVariables: 'msdyn_ocliveworkstreamcontextvariables?$select=msdyn_name,msdyn_displayname,msdyn_datatype,msdyn_ismodifiable,msdyn_isdisplayable,msdyn_islist,msdyn_issystemdefined,msdyn_relationshipname,msdyn_entitylogicalname,_msdyn_liveworkstreamid_value&$filter=statecode eq 0',
  assignmentConfigs: 'msdyn_assignmentconfigurations?$select=msdyn_name,_msdyn_queueid_value,msdyn_isactiveconfiguration',
  assignmentSteps: 'msdyn_assignmentconfigurationsteps?$select=msdyn_name,msdyn_steporder,msdyn_isdefaultruleset,_msdyn_assignmentconfigurationid_value,_msdyn_rulesetid_value',
  queues: 'queues?$select=name,msdyn_queuetype,msdyn_priority,msdyn_assignmentstrategy,msdyn_isdefaultqueue,_msdyn_operatinghourid_value,_msdyn_prequeueoverflowrulesetid_value,_msdyn_inqueueoverflowrulesetid_value&$filter=msdyn_isomnichannelqueue eq true',
  memberships: 'queuememberships?$select=queueid,systemuserid',
  users: 'systemusers?$select=fullname,internalemailaddress,isdisabled&$filter=queuemembership_association/any(q:q/msdyn_isomnichannelqueue eq true)',
  operatingHours: 'msdyn_operatinghours?$select=msdyn_name',
  overflowActions: 'msdyn_overflowactionconfigs?$select=msdyn_name,msdyn_overflowactiontype,msdyn_overflowactiondata',
  capacityProfiles: 'msdyn_capacityprofiles?$select=msdyn_name,msdyn_defaultmaxunits,msdyn_blockassignment',
  workstreamCapacity: 'msdyn_liveworkstreamcapacityprofiles?$select=msdyn_name,_msdyn_workstream_id_value,_msdyn_capacityprofile_id_value',
  voice: 'msdyn_ocvoicechannelsettings?$select=msdyn_name,_msdyn_liveworkstreamid_value,_msdyn_phonenumberid_value,_msdyn_operatinghoursid_value',
  whatsapp: 'msdyn_ocwhatsappchannelnumbers?$select=msdyn_name,msdyn_organizationphonenumber,_msdyn_liveworkstreamid_value',
  chat: 'msdyn_livechatconfigs?$select=msdyn_name,_msdyn_liveworkstreamid_value',
  teams: 'msdyn_octeamschannelconfigs?$select=msdyn_name,_msdyn_liveworkstreamid_value',
  facebook: 'msdyn_ocfbpages?$select=msdyn_fbpagename,_msdyn_liveworkstreamid_value',
  sms: 'msdyn_ocsmschannelsettings?$select=msdyn_name,_msdyn_liveworkstreamid_value',
  custom: 'msdyn_occustommessagingchannels?$select=msdyn_name,_msdyn_liveworkstreamid_value',
}

// One table of a snapshot's `raw` (keys as above); a table that failed to load is { error } and reads as empty.
export const rows = (raw, key) => (Array.isArray(raw[key]) ? raw[key] : [])

// queryData returns option-set and lookup labels in this annotation
export const FV = '@OData.Community.Display.V1.FormattedValue'
// label of a value as Dataverse formatted it, or the raw value
export const formatted = (row, field) => row?.[field + FV] ?? row?.[field]
