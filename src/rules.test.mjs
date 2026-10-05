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
console.log('rules ok')
