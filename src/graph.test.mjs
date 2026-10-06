import assert from 'node:assert/strict'
import { neighborhood, toMermaid, foldIntoQueues } from './graph.js'
import { LANGS } from './i18n.js'

const graph = {
  nodes: ['ch', 'ws', 'r1', 'r2', 'q1', 'q2', 'u1', 'u2'].map((id) => ({ id, type: id === 'u1' || id === 'u2' ? 'user' : 'x', label: id })),
  edges: [
    ['ch', 'ws'], ['ws', 'r1'], ['ws', 'r2'], ['r1', 'q1'], ['r2', 'q2'], ['q1', 'u1'], ['q2', 'u2'],
  ].map(([source, target]) => ({ source, target })),
}
const ids = (subgraph) => subgraph.nodes.map((node) => node.id).sort().join()

// user focus: only its path upstream, not the sibling branch
assert.equal(ids(neighborhood(graph, 'u1')), 'ch,q1,r1,u1,ws')
// workstream focus: whole tree down + channel up
assert.equal(ids(neighborhood(graph, 'ws')), 'ch,q1,q2,r1,r2,u1,u2,ws')
// hiding users stops the walk at queues
assert.equal(ids(neighborhood(graph, 'ws', { hideTypes: ['user'] })), 'ch,q1,q2,r1,r2,ws')
assert.match(toMermaid(neighborhood(graph, 'u1')), /nr1 --> nq1/)

// agents + PreQueue overflow folded into their queue; bot stays a node; focus never folded
const makeNode = (id, type, extra = {}) => ({ id, type, label: id, ...extra })
const queueGraph = {
  nodes: [makeNode('ws', 'workstream'), makeNode('qa', 'queue'), makeNode('qb', 'queue'), makeNode('qx', 'queue'), makeNode('u1', 'user'), makeNode('u2', 'user'), makeNode('bot', 'user'),
    makeNode('rs', 'ruleset'), makeNode('r1', 'rule', { sub: 'fuera de horario' }), makeNode('ov', 'overflow', { sub: '+34 971' }), makeNode('h', 'hours')],
  edges: [
    ['qa', 'u1', 'member'], ['qb', 'u1', 'member'], ['qb', 'u2', 'member'], ['ws', 'bot', 'bot', 'bot'], ['ws', 'qa'], ['ws', 'qb'], ['qa', 'h', 'hours'], ['qb', 'h', 'hours'],
    ['qa', 'rs', 'pre'], ['rs', 'r1', 'order', '#1'], ['r1', 'ov', 'route'], ['ov', 'qx', 'transfer', 'transfer'],
  ].map(([source, target, kind, label]) => ({ source, target, kind, label })),
}
const folded = foldIntoQueues(queueGraph)
const qa = folded.nodes.find((node) => node.id === 'qa')
assert.equal(ids(folded), 'bot,qa,qb,qx,ws')
assert.equal(folded.nodes.find((node) => node.id === 'qb').members.map((member) => member.id).join(), 'u1,u2')
assert.equal(qa.members.map((member) => member.id).join(), 'u1')
assert.equal(qa.pre[0].id, 'r1')
assert.equal(qa.pre[0].targets[0].id, 'ov')
// shared operating hours shown inside each queue, no shared node
assert.equal(qa.hours[0].id, 'h')
assert.equal(folded.nodes.find((node) => node.id === 'qb').hours[0].id, 'h')
assert.ok(folded.edges.some((edge) => edge.source === 'qa' && edge.target === 'qx' && edge.label === 'PreQueue: transfer'))
assert.match(toMermaid(folded, LANGS.es), /Cola: qb<br\/><b>Horario<\/b><br\/>- h<br\/><b>Agentes<\/b><br\/>- u1<br\/>- u2/)
assert.match(toMermaid(folded), /PreQueue<\/b><br\/>- fuera de horario → ov \+34 971/)
// focusing a member or an overflow rule keeps it as its own node
assert.ok(foldIntoQueues(queueGraph, 'u2').nodes.some((node) => node.id === 'u2'))
assert.ok(foldIntoQueues(queueGraph, 'r1').nodes.some((node) => node.id === 'rs'))
console.log('graph ok')
