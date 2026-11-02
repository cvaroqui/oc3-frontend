import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActionsMenu,
  type ActionEntry,
  type ActionTarget,
  type DataActionEntry,
} from "@/components/opensvc/ActionsMenu";
import { objectDataActions } from "@/components/opensvc/object-data-actions";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  CpuIcon,
  CubeIcon,
  DatabaseIcon,
  DownloadIcon,
  DropIcon,
  EyeOffIcon,
  FileIcon,
  GearIcon,
  LineChartIcon,
  ListChecksIcon,
  PowerIcon,
  PuzzleIcon,
  RefreshIcon,
  SearchIcon,
  ShapesIcon,
  SlidersIcon,
  SnowflakeIcon,
  SunIcon,
  TagIcon,
  TargetIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { inBatches } from "@/lib/api/batch";
import { api } from "@/lib/api/client";

/**
 * Agent actions of a node, the "node agent" entries of the historical collector
 * (`am_node_agent_leafs`), in one submenu per kind of effect and from the harmless
 * to the disruptive: what refreshes the collector's data and changes nothing on the
 * node; compliance; orchestration, where services may run; maintenance of the agent
 * and of the node's view of its storage; then, apart, the reboot and the shutdown.
 * Within a submenu the reversible entries come first. Wake On LAN, which goes
 * through another node, the provisioning from a template and the root password
 * rotation are not offered, as the API does not accept them.
 *
 * Each action is explained, as in the node actions menu of the om3 webapp
 * (`explained`): its icon, what it does in the foot of its submenu, the ones that
 * stop the services of the node red and badged; a field finds an action by its
 * words. The groups keep their submenus, the menu its size.
 */
const ICON = "h-4 w-4 shrink-0 text-ink-muted";
const DANGER_ICON = "h-4 w-4 shrink-0 text-state-down";

const ACTIONS: readonly ActionEntry[] = [
  { action: "pushasset", group: "refresh", icon: <CpuIcon className={ICON} /> },
  { action: "checks", group: "refresh", icon: <ListChecksIcon className={ICON} /> },
  { action: "sysreport", group: "refresh", icon: <FileIcon className={ICON} /> },
  { action: "pushdisks", group: "refresh", icon: <DatabaseIcon className={ICON} /> },
  { action: "pushpkg", group: "refresh", icon: <CubeIcon className={ICON} /> },
  { action: "pushpatch", group: "refresh", icon: <ShapesIcon className={ICON} /> },
  { action: "pushstats", group: "refresh", icon: <LineChartIcon className={ICON} /> },
  { action: "compliance_check", group: "compliance", icon: <TargetIcon className={ICON} /> },
  { action: "compliance_fix", group: "compliance", icon: <CheckIcon className={ICON} /> },
  { action: "updatecomp", group: "compliance", icon: <DownloadIcon className={ICON} /> },
  { action: "freeze", group: "orchestration", icon: <SnowflakeIcon className={ICON} /> },
  { action: "thaw", group: "orchestration", icon: <SunIcon className={ICON} /> },
  {
    action: "drain",
    group: "orchestration",
    separatorBefore: true,
    icon: <DropIcon className={DANGER_ICON} />,
    danger: true,
    impacts: ["downTime"],
  },
  { action: "updatepkg", group: "maintenance", icon: <UploadIcon className={ICON} /> },
  { action: "scanscsi", group: "maintenance", icon: <SearchIcon className={ICON} /> },
  {
    action: "schedule_reboot",
    group: "power",
    separatorBefore: true,
    icon: <CalendarIcon className={ICON} />,
  },
  { action: "unschedule_reboot", group: "power", icon: <CloseIcon className={ICON} /> },
  {
    action: "reboot",
    group: "power",
    separatorBefore: true,
    icon: <RefreshIcon className={DANGER_ICON} />,
    danger: true,
    impacts: ["downTime"],
  },
  {
    action: "shutdown",
    group: "power",
    icon: <PowerIcon className={DANGER_ICON} />,
    danger: true,
    impacts: ["downTime"],
  },
];

/** The icons of the submenus, by group. */
const GROUP_ICONS: Record<string, ReactNode> = {
  refresh: <RefreshIcon className={ICON} />,
  compliance: <TargetIcon className={ICON} />,
  orchestration: <SnowflakeIcon className={ICON} />,
  maintenance: <GearIcon className={ICON} />,
  power: <PowerIcon className={ICON} />,
  data: <DatabaseIcon className={ICON} />,
};

/** The icons of the data actions, by key. */
const DATA_ICONS: Record<string, ReactNode> = {
  notificationsOn: <BellIcon className={ICON} />,
  notificationsOff: <EyeOffIcon className={ICON} />,
  tagAttach: <TagIcon className={ICON} />,
  modulesetAttach: <PuzzleIcon className={ICON} />,
  modulesetDetach: <PuzzleIcon className={ICON} />,
  rulesetAttach: <SlidersIcon className={ICON} />,
  rulesetDetach: <SlidersIcon className={ICON} />,
};

/**
 * The agent actions, then the data actions of the historical collector ("Data
 * actions › On nodes"): notifications, tags and compliance attachments (see
 * objectDataActions), then, last, the deletion of the node from the collector,
 * offered to NodeManager as the API requires, which also checks the responsibility
 * for each node. `onDeleted` receives the ids of the nodes deleted.
 */
export function NodeActionsMenu({
  nodes,
  onDeleted,
  onCompare,
}: {
  nodes: ActionTarget[];
  /** Opens the comparison of the selection, see ActionsMenu. */
  onCompare?: () => void;
  onDeleted?: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // A batch answer as the report wants it: the objects done, and why the others failed.
  const report = (results: { item: ActionTarget; ok: boolean; message: string }[]) => ({
    done: results.flatMap((r) => (r.ok ? [r.item] : [])),
    failures: results.flatMap((r) =>
      r.ok ? [] : [t("nodes.actions.failure", { name: r.item.name, message: r.message })],
    ),
  });
  const dataActions: DataActionEntry[] = [
    ...objectDataActions("node", queryClient).map((entry) => ({
      ...entry,
      icon: DATA_ICONS[entry.key],
    })),
    {
      key: "delete",
      separatorBefore: true,
      icon: <TrashIcon className={DANGER_ICON} />,
      danger: true,
      privileges: ["NodeManager"],
      // Cascades on the collector side: instances, alerts, checks, packages, tags
      // and the other records of the node go with it. By batches: one request per
      // few hundred nodes.
      runAll: async (targets) =>
        report(
          await inBatches(targets, (batch) =>
            api.POST("/nodes/delete", { body: { ids: batch.map((target) => target.id) } }),
          ),
        ),
      onDone: (done) => {
        if (done.length === 0) return;
        void queryClient.invalidateQueries({ queryKey: ["nodes"] });
        onDeleted?.(done.map((target) => target.id));
      },
    },
  ];
  return (
    <ActionsMenu
      targets={nodes}
      actions={ACTIONS}
      dataActions={dataActions}
      onCompare={onCompare}
      prefix="nodes.actions"
      explained
      groupIcons={GROUP_ICONS}
      // `node_id` alone targets the node, as in the historical collector.
      enqueue={(target, action) => ({ node_id: target.id, action })}
    />
  );
}
