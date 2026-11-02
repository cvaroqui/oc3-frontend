import { describe, expect, it } from "vitest";
import { CANDIDATES_LIMIT, candidatesQuery, legacyFilter } from "./form-engine";

describe("legacyFilter", () => {
  it("translates the expressions of the historical filters", () => {
    expect(legacyFilter("mon_vmname !empty")).toEqual(["mon_vmname:!empty"]);
    expect(legacyFilter("mon_encap_frozen_at empty")).toEqual(["mon_encap_frozen_at:empty"]);
    expect(legacyFilter("mon_containerstatus up")).toEqual(["mon_containerstatus:eq:up"]);
    expect(legacyFilter("app my_app")).toEqual(["app:eq:my_app"]);
    expect(legacyFilter("os_name (Linux,SunOS)")).toEqual(["os_name:in:Linux,SunOS"]);
    expect(legacyFilter("cpu_threads >4")).toEqual(["cpu_threads:gt:4"]);
    expect(legacyFilter("updated <-1d")).toEqual(["updated:lt:-1d"]);
    expect(legacyFilter("nodename =n1")).toEqual(["nodename:eq:n1"]);
    expect(legacyFilter("nodename !n1")).toEqual(["nodename:!eq:n1"]);
    expect(legacyFilter("nodes.nodename n1")).toEqual(["nodes.nodename:eq:n1"]);
  });

  it("makes anchored regular expressions of the LIKE patterns", () => {
    expect(legacyFilter("svcname %web%")).toEqual(["svcname:~^.*web.*$"]);
    expect(legacyFilter("svcname a_b.%")).toEqual(["svcname:~^a.b\\..*$"]);
  });

  it("combines the chunks", () => {
    expect(legacyFilter("svcname !%test%&!empty")).toEqual([
      "svcname:!~^.*test.*$",
      "svcname:!empty",
    ]);
    expect(legacyFilter("os_name Linux|SunOS%")).toEqual(["os_name:~^(Linux|SunOS.*)$"]);
    expect(legacyFilter("os_name |Linux")).toEqual(["os_name:eq:Linux"]);
  });

  it("filters nothing where the historical collector filtered nothing", () => {
    expect(legacyFilter("svcname %")).toEqual([]);
    expect(legacyFilter("svcname ")).toEqual([]);
    expect(legacyFilter("svcname a&b|c")).toEqual([]);
  });

  it("refuses what it cannot translate", () => {
    expect(() => legacyFilter("os_name Linux|!SunOS")).toThrow(/unsupported/);
    expect(() => legacyFilter(" up")).toThrow(/no property/);
  });
});

describe("candidatesQuery", () => {
  it("sends the filters as oc3 filters, with a limit", () => {
    expect(
      candidatesQuery({
        props: "svc_id,node_id",
        filters: ["mon_vmname !empty", "mon_containerstatus up"],
      }),
    ).toEqual({
      props: "svc_id,node_id",
      filter: ["mon_vmname:!empty", "mon_containerstatus:eq:up"],
      limit: String(CANDIDATES_LIMIT),
    });
  });

  it("keeps the limit of the Args", () => {
    expect(candidatesQuery({ props: "nodename", limit: "0" })).toEqual({
      props: "nodename",
      limit: "0",
    });
  });
});
