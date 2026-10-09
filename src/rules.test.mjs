import assert from 'node:assert/strict'
import { parseRules, normGuid, simplify } from './rules.js'
import { LANGS } from './i18n.js'

const xml = `<decision>
  <rules>
    <rule id="r1" name="Advisor - Jane Doe">
      <logical operator="AND">
        <logical operator="AND">
          <condition operator="=="><lhs type="attribute">liveworkitemcontext.advisorEmail</lhs><rhs type="staticvalue">jane.doe@CONTOSO.COM</rhs></condition>
          <logical operator="OR">
            <condition operator="=="><lhs type="attribute">liveworkitemcontext.segment</lhs><rhs type="staticvalue">Premium</rhs></condition>
            <condition operator="not-null"><lhs type="attribute">x.y</lhs></condition>
          </logical>
        </logical>
      </logical>
      <action><setattribute><lhs type="attribute">assign_to.queue</lhs><rhs type="staticvalue">{AD696126-1C64-F111-A825-7CED8D2C35F6}</rhs></setattribute></action>
    </rule>
    <rule id="r2" name="route to agent">
      <action><orderby type="attribute" descending="false">agent.lastSessionAssignedOn</orderby></action>
    </rule>
  </rules>
</decision>`

const [r1, r2] = parseRules(xml)
assert.equal(r1.when, 'liveworkitemcontext.advisorEmail == "jane.doe@CONTOSO.COM" AND (liveworkitemcontext.segment == "Premium" OR x.y not-null)')
assert.deepEqual(r1.set, [{ attr: 'assign_to.queue', value: '{AD696126-1C64-F111-A825-7CED8D2C35F6}' }])
assert.equal(normGuid(r1.set[0].value), 'ad696126-1c64-f111-a825-7ced8d2c35f6')
assert.equal(r2.when, '')
assert.deepEqual(r2.orderBy, ['agent.lastSessionAssignedOn'])
assert.deepEqual(parseRules(null), [])
assert.equal(simplify('queue_prequeue.iswithinoperatinghour not-null AND queue_prequeue.iswithinoperatinghour == "false"', LANGS.es), 'fuera de horario')
assert.equal(simplify('a.b == "x" AND (c.d not-null AND c.d == "1")', LANGS.en), 'a.b == "x" AND (c.d == "1")')

// in-queue overflow (shape of a real org): bare conditions under <rule>, the wait time carries its unit
const [inQueue] = parseRules(`<decision hit-policy="all" version="1"><rules><rule id="o1" name="Rule1">
  <action><setattribute><lhs type="attribute">overflowaction.msdyn_overflowactionconfig.msdyn_overflowactionconfigid</lhs><rhs type="staticvalue">{08f6a0c1-2bad-f111-aaac-70a8a5b10059}</rhs></setattribute></action>
  <condition operator="not-null"><lhs type="attribute">queue_inqueue.lapsedwaittime</lhs></condition>
  <condition operator=">="><lhs type="attribute">queue_inqueue.lapsedwaittime</lhs><rhs type="staticvalue" unit="seconds">30</rhs></condition>
</rule></rules></decision>`)
assert.equal(simplify(inQueue.when, LANGS.en), 'queue_inqueue.lapsedwaittime >= 30s')
const waitOf = (seconds) => parseRules(`<rule id="w"><condition operator=">="><lhs type="attribute">x</lhs><rhs type="staticvalue" unit="seconds">${seconds}</rhs></condition></rule>`)[0].when
assert.deepEqual([7200, 3600, 120, 90, 172800].map(waitOf), ['x >= 2h', 'x >= 1h', 'x >= 2m', 'x >= 90s', 'x >= 2d'])
assert.equal(parseRules(`<rule id="o"><logical operator="AND"><logical operator="OR"><condition operator="=="><lhs type="attribute">a</lhs><rhs type="staticvalue">1</rhs></condition><condition operator="=="><lhs type="attribute">b</lhs><rhs type="staticvalue">2</rhs></condition></logical></logical></rule>`)[0].when,
  'a == "1" OR b == "2"')
// "in" a list: <rhs type="multistaticvalues"><value>..</value></rhs>
assert.equal(parseRules(`<rule id="m"><condition operator="in"><lhs type="attribute">agent.basePresenceStatus</lhs><rhs type="multistaticvalues"><value>192360001</value><value>192360000</value></rhs></condition></rule>`)[0].when,
  'agent.basePresenceStatus in ["192360001", "192360000"]')

// percentage-based routing: the queues live in <upsertrecords> records, not in assign_to.queue
const [split] = parseRules(`<decision><rules><rule id="p1" name="Split">
  <logical operator="AND"><logical operator="AND"><condition operator="=="><lhs type="attribute">liveworkitemcontext.lang</lhs><rhs type="staticvalue">NL</rhs></condition></logical></logical>
  <action><upsertrecords><target>percentagebaseddistribution</target><records>
    <record><setattribute><lhs type="attribute">queuedetails.queueid</lhs><rhs type="staticvalue">{C8B65393-839F-F111-AAAD-70A8A5B10059}</rhs></setattribute><setattribute><lhs type="attribute">queuedetails.percentage</lhs><rhs type="staticvalue">80</rhs></setattribute></record>
    <record><setattribute><lhs type="attribute">queuedetails.queueid</lhs><rhs type="staticvalue">{e11e9f11-2bad-f111-aaac-70a8a5b10059}</rhs></setattribute><setattribute><lhs type="attribute">queuedetails.percentage</lhs><rhs type="staticvalue">20</rhs></setattribute></record>
  </records></upsertrecords></action>
</rule></rules></decision>`)
assert.equal(split.when, 'liveworkitemcontext.lang == "NL"')
assert.deepEqual(split.set.map(({ value, percentage }) => [normGuid(value), percentage]), [['c8b65393-839f-f111-aaad-70a8a5b10059', '80'], ['e11e9f11-2bad-f111-aaac-70a8a5b10059', '20']])
console.log('rules ok')
