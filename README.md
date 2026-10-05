# Contact Center Map

A [Power Platform ToolBox](https://www.powerplatformtoolbox.com/) tool that draws the configuration of **Dynamics 365 Contact Center** (Omnichannel / unified routing) so you can understand and document it at a glance.

Pick a workstream, queue, rule or user and the tool draws everything that flows into and out of it:

**channel → workstream → routing rulesets → rules → queues**, with each queue showing its **operating hours**, **PreQueue / InQueue overflow** and **agents** inside its own card.

## Features

- Channels (voice with phone number, WhatsApp, chat, Teams, Facebook, SMS, custom messaging), bots and capacity profiles linked to each workstream.
- Routing rules shown as readable conditions (for example `If outside operating hours → Transfer to phone: +1 555 0100`), with the target queue resolved by name.
- Overflow actions resolved to their target queue or phone number. "Transfer to queue" overflows are also drawn as an arrow.
- Every box inside a queue card (operating hours, PreQueue, InQueue, agents) can be minimized with its **−/+** button, or all at once from the toolbar.
- One click on a card highlights its incoming path and everything below it; click the background to clear.
- **Export PNG** for documents and **Copy Mermaid** for wikis or Markdown.
- Optional **Edit mode** (off by default): add or remove agents from a queue straight from its card. See [What this tool changes](#what-this-tool-changes).
- Follows the ToolBox light and dark theme.
- Available in English, Spanish, Portuguese, French, German and Italian. The language follows your system and can be changed in the sidebar. Values coming from Dataverse (option sets, lookups) use the language of the connected user.

## Usage

1. Connect to an environment in Power Platform ToolBox (interactive login or client ID and secret; the connection is managed by ToolBox).
2. Open **Contact Center Map**. It reads the configuration of the active connection and reloads automatically when you switch connection. Use **↻** (next to the language) to re-read it after changing something in the admin center; the selected item and the map position are kept.
3. Choose an item from the list on the left.

## Permissions

The tool only reads data. The connected user (or application user) needs read access to the Omnichannel configuration tables, such as `msdyn_liveworkstream`, `msdyn_routingconfiguration`, `msdyn_decisionruleset`, `msdyn_assignmentconfiguration`, `queue`, `queuemembership`, `systemuser`, `msdyn_operatinghour`, `msdyn_overflowactionconfig` and the channel tables.

If a table cannot be read, the map is still drawn and the sidebar lists which tables failed and why.

## What this tool changes

By default, nothing: the map is read-only and only runs `GET` queries against the Dataverse Web API.

With **Edit mode** switched on (sidebar, off by default and only inside ToolBox), the tool can make exactly these changes:

| Change | Dataverse operation |
|---|---|
| Add a user to a queue | Associate `queue` ↔ `systemuser` (`queuemembership_association`), the same as *Add users* in the Contact Center admin center |
| Remove a user from a queue | Disassociate the same relationship |

Every change:

- starts only from an explicit click on **+ Add agent** or **×** in the queue's *Agents* box;
- shows a preview naming the user, the queue, the org and the environment type, with an extra warning for **Production** connections, and waits for confirmation;
- can be reverted with **Undo** in the message shown right after it;
- runs with the permissions of the ToolBox connection. Adding or removing queue members needs Append / Append To on *Queue* and *User* (for example the Omnichannel administrator role); if they are missing, the error from Dataverse is shown and nothing changes.

No other records are created, updated or deleted.

## Privacy

Credentials never reach the tool: all requests go through the ToolBox `dataverseAPI`. Nothing is sent anywhere else. Exported PNG and Mermaid files contain agent names and emails, so share them accordingly.

## Limitations

- Classification rules are shown as rules with their actions. Skills and capacity per agent are not drawn yet.
- Only the active routing configuration of each workstream and the active assignment configuration of each queue are shown.

## Development

```
npm install
npm run build   # dist/ for ToolBox
npm test        # parser, graph, i18n and ToolBox adapter checks
```

To try it locally in the desktop app: **Settings → Show Debug Menu**, then **Debug → Load Local Tool** and select this folder.

## AI-assisted development

Parts of this tool were generated with Claude Code (Anthropic) and reviewed, tested, and maintained by the contributors listed in package.json.

## License

MIT. The bundle includes third-party code under its own licenses:

- [React](https://github.com/facebook/react) and [React Flow](https://github.com/xyflow/xyflow): MIT
- [html-to-image](https://github.com/bubkoo/html-to-image): MIT
- [elkjs](https://github.com/kieler/elkjs) (Eclipse Layout Kernel): EPL-2.0. Source code is available at the linked repository.
