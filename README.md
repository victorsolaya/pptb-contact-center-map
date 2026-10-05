# Contact Center Map

A [Power Platform ToolBox](https://www.powerplatformtoolbox.com/) tool that draws the configuration of **Dynamics 365 Contact Center** (Omnichannel and unified routing) so you can understand and document it at a glance.

Pick a workstream, queue, rule or user and the tool draws everything that flows into and out of it:

**channel → workstream → routing rulesets → rules → queues**, with each queue showing its **operating hours**, **PreQueue and InQueue overflow** and **agents** inside its own card.

## Features

- Channels (voice with phone number, WhatsApp, chat, Teams, Facebook, SMS, custom messaging), bots and capacity profiles linked to each workstream.
- Routing rules shown as readable conditions (for example `If outside operating hours → Transfer to phone: +1 555 0100`), with the target queue resolved by name.
- Overflow actions resolved to their target queue or phone number. "Transfer to queue" overflows are also drawn as an arrow.
- Every section inside a queue card (operating hours, PreQueue, InQueue, agents) can be minimized with its **−/+** button, or all at once from the toolbar.
- One click on a card highlights its incoming path and everything below it; click the background to clear.
- **Export PNG** for documents and **Copy Mermaid** for wikis or Markdown.
- Optional **Edit mode** (off by default): add or remove agents, create queues, create workstreams from an existing one, and add or delete rules in route-to-queue and classification rulesets, with preview, confirmation and undo. See [What this tool changes](#what-this-tool-changes).
- Follows the ToolBox light and dark theme.
- Available in English, Spanish, Portuguese, French, German and Italian. The language follows your system and can be changed in the sidebar. Values coming from Dataverse (option sets, lookups) use the language of the connected user.

## Usage

1. Connect to an environment in Power Platform ToolBox (interactive login or client ID and secret; the connection is managed by ToolBox).
2. Open **Contact Center Map**. It reads the configuration of the active connection and reloads automatically when you switch connection. Use **↻** (next to the language) to re-read it after changing something in the admin center; the selected item and the map position are kept.
3. Choose an item from the list on the left.

## Permissions

The map only needs read access. The connected user (or application user) must be able to read the Omnichannel configuration tables, such as `msdyn_liveworkstream`, `msdyn_routingconfiguration`, `msdyn_decisionruleset`, `msdyn_decisioncontract`, `msdyn_ocliveworkstreamcontextvariable`, `msdyn_assignmentconfiguration`, `queue`, `queuemembership`, `systemuser`, `msdyn_operatinghour`, `msdyn_overflowactionconfig` and the channel tables. Edit mode needs the extra privileges listed in [What this tool changes](#what-this-tool-changes).

If a table cannot be read, the map is still drawn and the sidebar lists which tables failed and why.

## What this tool changes

By default, nothing: the map is read-only and only runs `GET` queries against the Dataverse Web API.

With **Edit mode** switched on (a switch in the sidebar, off by default and only available inside ToolBox), the tool can make exactly these changes:

| Change | Dataverse operation | Undo |
|---|---|---|
| Add a user to a queue | Associate `queue` ↔ `systemuser` (`queuemembership_association`), the same as *Add users* in the Contact Center admin center | Removes the user again |
| Remove a user from a queue | Disassociate the same relationship | Adds the user again |
| Create an omnichannel queue | Create `queue` (name, type, assignment method, priority, operating hours). Type and assignment method only offer values already used by existing omnichannel queues | Deletes the new queue |
| Create a workstream from an existing one (same channel) | Create, in this order: a routing contract (`msdyn_decisioncontract`) with the template's context variables, the workstream (`msdyn_liveworkstream`) with the template's settings, default queue, session and notification templates, its context variables, its capacity profile links, and and, when the template has a route-to-queue step, an active routing configuration with one queue-identification step and a route-to-queue ruleset (empty, or with the template's rules copied). The channel, bots and API keys are not copied; classification steps are not copied. If any record fails, the ones already created are deleted before the error is shown | Deletes every created record, newest first |
| Add a rule to a **route-to-queue** or **classification** ruleset | Update `msdyn_decisionruleset.msdyn_rulesetdefinition`: the new `<rule>` is appended at the end; the rest of the definition is left untouched | Writes the previous definition back |
| Delete a rule from those rulesets | Same update, removing that one `<rule>` | Writes the previous definition back |

Overflow, assignment and system rulesets are never edited. Rule conditions can only use the variables of the ruleset's input contract (or attributes its rules already use) and operators already used in the environment. Before writing a ruleset, the tool reads it again and refuses to write if it changed since the map was loaded (for example in the admin center).

Every change:

- starts only from an explicit click (**+ Add agent**, **×**, **Create → Queue** or **Create → Workstream**, **+ Add rule**);
- shows a preview naming what changes, the org and the environment type, with an extra warning for **Production** connections, and waits for confirmation;
- can be reverted with **Undo** in the message shown right after it;
- runs with the permissions of the ToolBox connection. It needs Append and Append To on *Queue* and *User* (agents), Create and Delete on *Queue* (queues), Write on *Decision rule set* (rules), and Create and Delete on *Workstream*, *Decision contract*, *Decision rule set*, *Routing configuration*, *Routing configuration step*, *Context variable* and *Workstream capacity profile* (workstreams); the Omnichannel administrator role, for example, covers them. If any is missing, the Dataverse error is shown and nothing changes.

No other records are created, updated or deleted. Creating new context variables is not supported yet.

## Privacy

Credentials never reach the tool: all requests go through the ToolBox `dataverseAPI`. Nothing is sent anywhere else. Exported PNG and Mermaid files contain agent names and emails, so share them accordingly.

## Limitations

- Classification rules are shown as rules with their actions. Skills and capacity per agent are not drawn yet.
- Only the active routing configuration of each workstream and the active assignment configuration of each queue are shown.

## Development

```
npm install
npm run build   # dist/ for ToolBox
npm test        # parser, graph, i18n, ToolBox adapter and edit checks
```

To try it locally in the desktop app: **Settings → Show Debug Menu**, then **Debug → Load Local Tool** and select this folder.

## AI-assisted development

Parts of this tool were generated with Claude Code (Anthropic) and reviewed, tested, and maintained by the contributors listed in package.json.

## License

MIT. The bundle includes third-party code under its own licenses:

- [React](https://github.com/facebook/react) and [React Flow](https://github.com/xyflow/xyflow): MIT
- [html-to-image](https://github.com/bubkoo/html-to-image): MIT
- [elkjs](https://github.com/kieler/elkjs) (Eclipse Layout Kernel): EPL-2.0. Source code is available at the linked repository.
