import assert from 'node:assert/strict'

const store = {}
globalThis.dataverseAPI = {
  retrieve: async (_entity, id) => ({ msdyn_recordidentificationrule: store[id] }),
  update: async (_entity, id, record) => { store[id] = record.msdyn_recordidentificationrule },
}
const { parseIdentification, rewriteIdentification, valueOptions, summarizeIdentification, valueLabel, writeIdentification, filterXml, formatXml, xmlProblem, lineDiff } = await import('./identification.js')
const { LANGS } = await import('./i18n.js')

// The sample from Microsoft's "Enable fields for identifying customers" page (voice workstream).
const PHONE = 'msdyn_msdyn_ocliveworkitem_msdyn_ocphonecallengagementctx_liveworkitemid'
const sample = `<RecordIdentificationRuleSet><RecordIdentificationRule>\t<PrimaryEntity LogicalCollectionName="accounts" PrimaryKeyAttribute="accountid" PrimaryNameAttribute="name"/>\t<fetch version="1.0" output-format="xml-platform" mapping="logical" top="2">\t\t<entity name="account">\t\t\t<attribute name="accountid"/>\t\t\t<attribute name="name"/>\t\t\t<filter type="and">\t\t\t\t<condition attribute="statuscode" operator="eq" value="1"/>\t\t\t\t<condition attribute="name" operator="eq" value="\${Name}"/>\t\t\t\t<filter type="or">\t\t\t\t\t<condition attribute="telephone1" operator="eq" source="${PHONE}" value="\${msdyn_fromphone}"/>\t\t\t\t\t<condition attribute="telephone2" operator="eq" source="${PHONE}" value="\${msdyn_fromphone}"/>\t\t\t\t</filter>\t\t\t\t<condition attribute="emailaddress1" operator="eq" value="\${Email}"/>\t\t\t</filter>\t\t</entity>\t</fetch>\t<ContextKey name="msdyn_account_msdyn_ocliveworkitem_Customer" isPreferred="false"/></RecordIdentificationRule><RecordIdentificationRule>\t<PrimaryEntity LogicalCollectionName="contacts" PrimaryKeyAttribute="contactid" PrimaryNameAttribute="fullname"/>\t<fetch version="1.0" output-format="xml-platform" mapping="logical" top="2">\t\t<entity name="contact">\t\t\t<attribute name="contactid"/>\t\t\t<attribute name="fullname"/>\t\t\t<filter type="and">\t\t\t\t<condition attribute="statuscode" operator="eq" value="1"/>\t\t\t\t<condition attribute="fullname" operator="eq" value="\${Name}"/>\t\t\t\t<filter type="or">\t\t\t\t\t<condition attribute="mobilephone" operator="eq" source="${PHONE}" value="\${msdyn_fromphone}"/>\t\t\t\t\t<condition attribute="telephone1" operator="eq" source="${PHONE}" value="\${msdyn_fromphone}"/>\t\t\t\t</filter>\t\t\t\t<condition attribute="emailaddress1" operator="eq" value="\${Email}"/>\t\t\t</filter>\t\t</entity>\t</fetch>\t<ContextKey name="msdyn_contact_msdyn_ocliveworkitem_Customer" isPreferred="true"/></RecordIdentificationRule><RecordIdentificationRule>\t<PrimaryEntity LogicalCollectionName="incidents" PrimaryKeyAttribute="incidentid" PrimaryNameAttribute="title"/>\t<fetch version="1.0" output-format="xml-platform" mapping="logical" top="2">\t\t<entity name="incident">\t\t\t<attribute name="incidentid"/>\t\t\t<attribute name="title"/>\t\t\t<filter type="and">\t\t\t\t<condition attribute="ticketnumber" operator="eq" value="\${CaseNumber}"/>\t\t\t\t<filter type="or">\t\t\t\t\t<filter type="and">\t\t\t\t\t\t<condition attribute="name" operator="eq" value="\${Name}" entityname="ac"/>\t\t\t\t\t</filter>\t\t\t\t</filter>\t\t\t</filter>\t\t<link-entity name="account" from="accountid" to="customerid" link-type="outer" alias="ac"/>\t</entity></fetch><ContextKey name="msdyn_incident_msdyn_ocliveworkitem"/></RecordIdentificationRule></RecordIdentificationRuleSet>`

// reading
const rules = parseIdentification(sample)
assert.deepEqual(rules.map((rule) => [rule.entity, rule.preferred, rule.supported]), [['account', false, true], ['contact', true, true], ['incident', null, false]])
// every condition is a row, fixed values (statuscode = 1) included
assert.deepEqual(rules[1].matches, [
  { conditions: [{ attribute: 'statuscode', operator: 'eq', value: '1', source: undefined }] },
  { conditions: [{ attribute: 'fullname', operator: 'eq', value: '${Name}', source: undefined }] },
  { conditions: [
    { attribute: 'mobilephone', operator: 'eq', value: '${msdyn_fromphone}', source: PHONE },
    { attribute: 'telephone1', operator: 'eq', value: '${msdyn_fromphone}', source: PHONE },
  ] },
  { conditions: [{ attribute: 'emailaddress1', operator: 'eq', value: '${Email}', source: undefined }] },
])
assert.deepEqual(parseIdentification(null), [])

// nothing changed: the column is written back exactly as it was
assert.equal(rewriteIdentification(sample, rules), sample)

// edit the contact rule only: add Home Phone to the caller-phone group, drop the name match
const edited = structuredClone(rules)
edited[1].matches = [
  rules[1].matches[0],
  { conditions: [...rules[1].matches[2].conditions, { ...rules[1].matches[2].conditions[1], attribute: 'telephone2' }] },
  rules[1].matches[3],
]
const next = rewriteIdentification(sample, edited)
const [account, contact, incident] = parseIdentification(next)
assert.deepEqual(contact.matches.map((match) => match.conditions.map((condition) => condition.attribute)), [['statuscode'], ['mobilephone', 'telephone1', 'telephone2'], ['emailaddress1']])
assert.deepEqual(contact.matches[0], rules[1].matches[0], 'statuscode = 1 is kept')
const slice = (xml, rule) => xml.slice(...rule.filterRange)
assert.equal(slice(next, account), slice(sample, rules[0]), 'account untouched')
assert.ok(next.endsWith(sample.slice(sample.indexOf('<RecordIdentificationRule>\t<PrimaryEntity LogicalCollectionName="incidents"'))), 'incident untouched byte for byte')
assert.equal(incident.supported, false)

// switch the preferred table: only the two isPreferred values change
const preferAccount = structuredClone(rules)
preferAccount[0].preferred = true
preferAccount[1].preferred = false
const swapped = rewriteIdentification(sample, preferAccount)
assert.deepEqual(parseIdentification(swapped).map((rule) => rule.preferred), [true, false, null])
const swappedByHand = sample.replace('isPreferred="false"', 'isPreferred="TMP"').replace('isPreferred="true"', 'isPreferred="false"').replace('isPreferred="TMP"', 'isPreferred="true"')
assert.equal(swapped, swappedByHand)

// values are escaped when written
assert.equal(filterXml([{ conditions: [{ attribute: 'new_code', operator: 'eq', value: '${A&B}' }] }]), '<filter type="and"><condition attribute="new_code" operator="eq" value="${A&amp;B}"/></filter>')
// conditions without a value (null, not-null) are written without one
assert.equal(filterXml([{ conditions: [{ attribute: 'emailaddress1', operator: 'not-null' }] }]), '<filter type="and"><condition attribute="emailaddress1" operator="not-null"/></filter>')
// comments are not read as conditions, and a rule containing one is not edited
const commented = sample.replace('<condition attribute="fullname"', '<!-- <condition attribute="new_vip" operator="eq" value="1"/> --><condition attribute="fullname"')
assert.equal(parseIdentification(commented)[1].supported, false)
assert.equal(parseIdentification(commented)[1].preferred, null)
assert.equal(rewriteIdentification(commented, parseIdentification(commented)), commented)
// isPreferred="True" counts as preferred
assert.equal(parseIdentification(sample.replace('isPreferred="true"', 'isPreferred="True"'))[1].preferred, true)
// a filter with attributes other than type is not edited (they would be lost)
assert.equal(parseIdentification(sample.replace('<filter type="and">', '<filter type="and" hint="x">'))[0].supported, false)
// numeric character references are decoded once and written back as the same value
const numeric = sample.replace('value="1"/>\t\t\t\t<condition attribute="fullname"', 'value="A&#38;B"/>\t\t\t\t<condition attribute="fullname"')
assert.equal(parseIdentification(numeric)[1].matches[0].conditions[0].value, 'A&B')
// alternatives with their own operator and value: (statuscode = 1 or statecode = 0), and they read as such
const either = [{ conditions: [{ attribute: 'statuscode', operator: 'eq', value: '1' }, { attribute: 'statecode', operator: 'eq', value: '0' }] }]
assert.equal(filterXml(either), '<filter type="and"><filter type="or"><condition attribute="statuscode" operator="eq" value="1"/><condition attribute="statecode" operator="eq" value="0"/></filter></filter>')
const mixedGroup = sample.replace('<condition attribute="telephone1" operator="eq" source="' + PHONE + '" value="${msdyn_fromphone}"/>\t\t\t\t\t<condition attribute="telephone2"', '<condition attribute="telephone1" operator="eq" value="${Phone}"/>\t\t\t\t\t<condition attribute="telephone2"')
assert.equal(parseIdentification(mixedGroup)[0].supported, true, 'an OR group whose alternatives compare different values is editable')
assert.match(summarizeIdentification(mixedGroup, LANGS.en), /telephone1 = Phone \(pre-chat answer\) or telephone2 = Customer’s phone number/)

// value options: seen in the org (with source), documented keys, this workstream's context variables
const raw = {
  workstreams: [{ msdyn_liveworkstreamid: 'ws-1', msdyn_recordidentificationrule: sample }, { msdyn_liveworkstreamid: 'ws-2' }],
  contextVariables: [{ _msdyn_liveworkstreamid_value: 'ws-1', msdyn_name: 'CustomerId' }, { _msdyn_liveworkstreamid_value: 'ws-2', msdyn_name: 'Other' }],
}
const options = valueOptions(raw, 'ws-1')
assert.ok(!options.some((option) => option.value === '1'), 'fixed values are not offered as conversation values')
assert.ok(options.some((option) => option.value === '${msdyn_fromphone}' && option.source === PHONE))
assert.ok(options.some((option) => option.value === '${CaseNumber}'))
assert.ok(options.some((option) => option.value === '${CustomerId}'))
assert.ok(!options.some((option) => option.value === '${Other}'))
assert.equal(options.filter((option) => option.value === '${Name}').length, 1, 'no duplicates')

// summary for the detail panel
const summary = summarizeIdentification(sample, LANGS.en).split('\n')
assert.deepEqual(summary.slice(5, 10), ['Contact (preferred)', '  statuscode = "1" (fixed value)', '  fullname = Name (pre-chat answer)', '  mobilephone or telephone1 = Customer’s phone number', '  emailaddress1 = Email (pre-chat answer)'])
assert.deepEqual(summary.slice(10), ['Case', '  advanced rule (links other tables)'])
assert.equal(valueLabel({ value: '${CustomerId}' }, LANGS.en), 'CustomerId (context variable)')
assert.equal(valueLabel({ value: '${msdyn_customerphone}', source: 'x' }, LANGS.en), 'msdyn_customerphone (conversation)')
assert.equal(valueLabel({ value: undefined }, LANGS.en), '')

// FetchXML view: formatting keeps the meaning, and edits still work on the formatted text
const meaning = (xml) => parseIdentification(xml).map(({ entity, preferred, supported, matches }) => ({ entity, preferred, supported, matches }))
const pretty = formatXml(sample)
assert.ok(pretty.startsWith('<RecordIdentificationRuleSet>\n  <RecordIdentificationRule>\n    <PrimaryEntity '))
assert.deepEqual(meaning(pretty), meaning(sample))
assert.deepEqual(meaning(rewriteIdentification(pretty, edited)), meaning(next))
assert.equal(formatXml(pretty), pretty, 'formatting is stable')

// validation of hand-edited XML
assert.equal(xmlProblem(sample), null)
assert.equal(xmlProblem(pretty), null)
assert.equal(xmlProblem('<?xml version="1.0"?>' + sample), null)
assert.equal(xmlProblem(sample.replace('</fetch>', '')).code, 'notWellFormed')
assert.equal(xmlProblem(sample.replace('value="${Email}"', 'value="${Email}')).code, 'notWellFormed')
assert.equal(xmlProblem(sample + '<RecordIdentificationRuleSet/>').code, 'notWellFormed', 'two roots')
assert.equal(xmlProblem('text' + sample).code, 'notWellFormed')
assert.equal(xmlProblem('<Rules/>').code, 'noRuleSet')
assert.equal(xmlProblem('<RecordIdentificationRuleSet></RecordIdentificationRuleSet>').code, 'noRules')
assert.deepEqual(xmlProblem(sample.replace('<ContextKey name="msdyn_contact_msdyn_ocliveworkitem_Customer" isPreferred="true"/>', '')), { code: 'ruleIncomplete', detail: 2 })
assert.equal(xmlProblem(sample.replace('isPreferred="false"', 'isPreferred="true"')).code, 'twoPreferred')
// single quotes and spaces around "=" are valid XML and are read too
assert.equal(parseIdentification(sample.replace('isPreferred="true"', "isPreferred = 'true'"))[1].preferred, true)
assert.equal(xmlProblem(sample.replace('name="contact"', "name='contact'")), null)

// review diff of the formatted XML
assert.deepEqual(lineDiff('a\nb\nc', 'a\nc\nd'), [{ type: '-', text: 'b' }, { type: '+', text: 'd' }])
assert.deepEqual(lineDiff(pretty, pretty), [])

// a whole rule commented out at rule-set level is not a rule, and positions still point at the real text
const ruleSetComment = sample.replace('<RecordIdentificationRuleSet>', '<RecordIdentificationRuleSet><!--<RecordIdentificationRule><fetch><entity name="lead"><filter type="and"/></entity></fetch><ContextKey name="x" isPreferred="true"/></RecordIdentificationRule>-->')
assert.deepEqual(parseIdentification(ruleSetComment).map((rule) => rule.entity), ['account', 'contact', 'incident'])
assert.ok(rewriteIdentification(ruleSetComment, edited).includes('<!--<RecordIdentificationRule><fetch><entity name="lead">'), 'the comment is kept')
assert.deepEqual(meaning(rewriteIdentification(ruleSetComment, edited)), meaning(next))
// a ">" inside a quoted value is part of the value
const angle = sample.replace('value="${Email}"/>', 'value="a>b"/>')
assert.equal(xmlProblem(angle), null)
assert.ok(formatXml(angle).includes('value="a>b"/>'))
// "&#38;amp;" is decoded once, to "&amp;"
assert.equal(parseIdentification(sample.replace('value="1"/>\t\t\t\t<condition attribute="fullname"', 'value="&#38;amp;"/>\t\t\t\t<condition attribute="fullname"'))[1].matches[0].conditions[0].value, '&amp;')
// a table with no condition would match every record; a condition needs a column
assert.deepEqual(xmlProblem(rewriteIdentification(sample, edited.map((rule, i) => (i === 0 ? { ...rule, matches: [] } : rule)))), { code: 'noConditions', detail: 1 })
assert.deepEqual(xmlProblem(sample.replace('attribute="fullname"', 'attribute=""')), { code: 'conditionWithoutColumn', detail: 2 })

// optimistic write
store['ws-1'] = sample.replace(/\n/g, '\r\n')
await writeIdentification('ws-1', sample, next)
assert.equal(store['ws-1'], next)
await assert.rejects(writeIdentification('ws-1', sample, swapped), (e) => e.code === 'staleRecord')
console.log('identification ok')
