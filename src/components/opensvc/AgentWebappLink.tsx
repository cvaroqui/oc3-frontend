import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { components } from "@/lib/api/schema";
import { api } from "@/lib/api/client";
import { problemText } from "@/lib/api/problem";
import { ExternalLinkIcon } from "@/components/ui/icons";

type NodeRow = components["schemas"]["NodeRow"];
type NodeAddress = Pick<NodeRow, "fqdn" | "listener_port">;

/** A host name alone: an fqdn can be edited, it must not bring a path or a user with it. */
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i;

/**
 * Where the listener of a node's agent answers: the fqdn and the port the agent
 * pushes with its asset. Undefined when the collector does not know them.
 */
function listenerOrigin({ fqdn, listener_port: port }: NodeAddress): string | undefined {
  if (typeof fqdn !== "string" || !HOST.test(fqdn)) return undefined;
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined;
  }
  return `https://${fqdn}:${port}`;
}

/** The nodes a filter selects, with what it takes to reach their agent. */
function useNodeAddresses(filter: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["nodes", "webapp", filter],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await api.GET("/nodes", {
        params: { query: { props: "nodename,fqdn,listener_port", limit: 0, filter } },
      });
      if (error !== undefined) throw new Error(problemText(error));
      const rows: NodeRow[] = Array.isArray(data.data) ? data.data : [];
      return rows;
    },
  });
}

/** The link itself, shown only when the agent's address is known. */
function WebappLink({ origin, path }: { origin: string | undefined; path: string }) {
  const { t } = useTranslation();
  if (origin === undefined) return null;
  return (
    <a
      href={`${origin}${path}`}
      target="_blank"
      rel="noopener noreferrer"
      title={origin}
      className="flex h-7 items-center gap-1.5 rounded-(--radius-control) border border-line px-2 whitespace-nowrap text-ink-muted hover:border-line-strong hover:text-ink"
    >
      <ExternalLinkIcon className="h-3.5 w-3.5" />
      {t("agentWebapp.open")}
      <span className="sr-only">{t("header.newTab")}</span>
    </a>
  );
}

/** The webapp of a node's agent. */
export function NodeWebappLink({ node }: { node: NodeAddress | null | undefined }) {
  return (
    <WebappLink
      origin={node === null || node === undefined ? undefined : listenerOrigin(node)}
      path="/ui/"
    />
  );
}

/**
 * A service in the webapp, through the first of its nodes the collector has an
 * address for, in the order of `svc_nodes`: any node of the cluster shows it.
 */
export function ServiceWebappLink({
  svcname,
  nodes,
  clusterId,
}: {
  svcname: string | undefined;
  nodes: string | undefined;
  clusterId: string | undefined;
}) {
  const names = (nodes ?? "").split(/[\s,]+/).filter((name) => name !== "");
  const filter = [`nodename:in:${names.join(",")}`];
  if (clusterId !== undefined && clusterId !== "") filter.push(`cluster_id:eq:${clusterId}`);
  const { data: rows } = useNodeAddresses(filter, names.length > 0);
  if (svcname === undefined || svcname === "") return null;

  const origin = names
    .map((name) => rows?.find((row) => row.nodename === name))
    .flatMap((row) => (row === undefined ? [] : [listenerOrigin(row)]))
    .find((value) => value !== undefined);
  return <WebappLink origin={origin} path={`/ui/objects/${encodeURIComponent(svcname)}`} />;
}

/** An instance in the webapp, through the agent of the node it runs on. */
export function InstanceWebappLink({
  svcname,
  nodename,
  nodeId,
}: {
  svcname: string | null | undefined;
  nodename: string | null | undefined;
  nodeId: string | undefined;
}) {
  const { data: rows } = useNodeAddresses([`node_id:eq:${nodeId ?? ""}`], nodeId !== undefined);
  const node = rows?.[0];
  if (node === undefined || !svcname || !nodename) return null;

  const path = `/ui/nodes/${encodeURIComponent(nodename)}/objects/${encodeURIComponent(svcname)}`;
  return <WebappLink origin={listenerOrigin(node)} path={path} />;
}
