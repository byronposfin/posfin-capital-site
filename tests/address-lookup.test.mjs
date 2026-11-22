import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import handler from "../api/address-lookup.js";
import propertydata from "../api/propertydata.js";
import propertydataAvm from "../api/propertydata-avm.js";
import { propertyDataKey } from "../lib/propertydata-env.js";
import { FINDER_MARKUP, bindSecurityAddressPicker } from "../lib/ff-address-picker.js";
import { bindPostcode } from "../lib/ff-inputs.js";

const KEYS = ["PROPERTYDATA_API_KEY", "PROPERTYDATA_KEY", "IDEAL_POSTCODES_API_KEY", "GETADDRESS_API_KEY"];
const SECRET = "pd-secret-key";
const IDEAL_SECRET = "ideal-secret-key";
const GETADDRESS_SECRET = "getaddress-secret-key";
const root = fileURLToPath(new URL("..", import.meta.url));
let ipCount = 0;
let logs = [];
const originalFetch = globalThis.fetch;
const originalError = console.error;

function nextIp() {
  ipCount += 1;
  return `198.51.100.${ipCount}`;
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function savedEnv() {
  return Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(previous) {
  for (const key of KEYS) {
    if (previous[key] == null) delete process.env[key];
    else process.env[key] = previous[key];
  }
}

function setEnv(values) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

async function invoke(postcode, { ip = nextIp(), headers = {} } = {}) {
  const res = mockRes();
  await handler({ method: "GET", query: { postcode }, headers: { "x-forwarded-for": ip, ...headers } }, res);
  return res;
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function routeFetch(routes) {
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = String(input?.url || input);
    calls.push(url);
    const hit = routes.find((route) => url.includes(route.match));
    if (!hit) throw new Error("unexpected upstream");
    if (hit.impl) return hit.impl(url);
    return jsonResponse(hit.status ?? 200, hit.body);
  };
  return calls;
}

function propertyDataSuccess(addresses = ["Flat 1, 10 Sample Street, London, SW6 5AA"]) {
  return {
    match: "api.propertydata.co.uk/uprns",
    body: {
      status: "success",
      data: addresses.map((address) => ({ address, addressParts: { postcode: "SW6 5AA" } })),
    },
  };
}

function postcodesHit(body, status = 200) {
  return { match: "api.postcodes.io/postcodes/", status, body };
}

const LONDON = postcodesHit({
  status: 200,
  result: { postcode: "SW6 5AA", admin_district: "Hammersmith and Fulham", region: "London", country: "England" },
});

function contrast(hexA, hexB) {
  const lum = (hex) => {
    const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    const channel = (n) => {
      const value = parseInt(full.slice(n, n + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = [1, 3, 5].map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function makeEl(id) {
  const listeners = {};
  const classes = new Set();
  return {
    id,
    value: "",
    disabled: false,
    size: 1,
    placeholder: "",
    textContent: "",
    innerHTML: "",
    dataset: {},
    attrs: {},
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(event) { (listeners[event.type] || []).forEach((fn) => fn(event)); return true; },
    focus() { this.focused = true; },
    setSelectionRange(start) { this.selectionStart = start; this.selectionEnd = start; },
    selectionStart: 0,
    selectionEnd: 0,
  };
}

describe("address lookup", { concurrency: 1 }, () => {
  let previousEnv;
  beforeEach(() => {
    previousEnv = savedEnv();
    logs = [];
    console.error = (...args) => { logs.push(args.map(String).join(" ")); };
    setEnv({});
  });
  afterEach(() => {
    restoreEnv(previousEnv);
    globalThis.fetch = originalFetch;
    console.error = originalError;
  });

  test("returns PropertyData premises and keeps the key off the response", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET });
    const calls = routeFetch([propertyDataSuccess()]);
    const res = await invoke("sw6 5aa");
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.deepEqual(res.body.addresses, [{ address: "Flat 1, 10 Sample Street, London, SW6 5AA" }]);
    assert.equal(JSON.stringify(res.body).includes(SECRET), false);
    assert.match(calls[0], /postcode=SW65AA/);
    assert.match(calls[0], new RegExp(`key=${SECRET}`));
    assert.equal(logs.length, 0);
  });

  test("accepts PROPERTYDATA_KEY when PROPERTYDATA_API_KEY is unset", async () => {
    setEnv({ PROPERTYDATA_KEY: "legacy-key" });
    const calls = routeFetch([propertyDataSuccess(["12 Sample Street, London, SW6 5AA"])]);
    const res = await invoke("SW6 5AA");
    assert.equal(res.statusCode, 200);
    assert.match(calls[0], /key=legacy-key/);
    assert.equal(res.body.addresses[0].address, "12 Sample Street, London, SW6 5AA");
  });

  test("PropertyData error codes are logged and returned as sanitized reasons", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET });
    const cases = [
      ["X03", 401, "provider_auth"],
      ["X05", 403, "provider_auth"],
      ["X04", 200, "provider_quota"],
      ["X13", 200, "provider_quota"],
      ["X08", 503, "provider_unavailable"],
    ];
    for (const [code, status, reason] of cases) {
      logs = [];
      routeFetch([
        { match: "api.propertydata.co.uk/uprns", status, body: { status: "error", code, message: `key ${SECRET} failed` } },
        LONDON,
      ]);
      const res = await invoke("SW6 5AA");
      assert.equal(res.statusCode, 502, code);
      assert.equal(res.body.reason, reason, code);
      assert.equal(res.body.code, code);
      assert.equal(res.body.locality, "Hammersmith and Fulham, London");
      assert.match(res.body.error, /Hammersmith and Fulham/);
      assert.match(res.body.error, /enter the building number and street manually/i);
      assert.equal(JSON.stringify(res.body).includes(SECRET), false);
      const entry = JSON.parse(logs.at(-1));
      assert.equal(entry.event, "address_lookup_provider_failure");
      assert.equal(entry.provider, "propertydata");
      assert.equal(entry.code, code);
      assert.equal(entry.reason, reason);
      assert.equal(entry.httpStatus, status);
      assert.equal(logs.some((line) => line.includes(SECRET) || line.includes("SW6")), false);
    }
  });

  test("a thrown PropertyData call stays provider_unavailable and does not log the key", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET });
    routeFetch([{ match: "api.propertydata.co.uk/uprns", impl: () => { throw new Error(`network ${SECRET} https://api.propertydata.co.uk/uprns?key=${SECRET}`); } }, LONDON]);
    const res = await invoke("WC2H 9JQ");
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.reason, "provider_unavailable");
    assert.equal(res.body.code, undefined);
    assert.equal(logs.join("\n").includes(SECRET), false);
  });

  test("Ideal Postcodes is used when PropertyData has no credits", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET, IDEAL_POSTCODES_API_KEY: IDEAL_SECRET });
    const calls = routeFetch([
      { match: "api.propertydata.co.uk/uprns", status: 200, body: { status: "error", code: "X04" } },
      { match: "api.ideal-postcodes.co.uk", body: { code: 2000, result: [{ line_1: "1 Ideal House", line_2: "", post_town: "LONDON", postcode: "SW6 5AA" }] } },
    ]);
    const res = await invoke("SW6 5AA");
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.addresses, [{ address: "1 Ideal House, LONDON, SW6 5AA" }]);
    assert.match(calls[1], new RegExp(`api_key=${IDEAL_SECRET}`));
    assert.equal(JSON.stringify(res.body).includes(IDEAL_SECRET), false);
    assert.equal(JSON.parse(logs[0]).code, "X04");
    assert.equal(calls.some((url) => url.includes("postcodes.io")), false);
  });

  test("getAddress is used when earlier full-address providers fail", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET, IDEAL_POSTCODES_API_KEY: IDEAL_SECRET, GETADDRESS_API_KEY: GETADDRESS_SECRET });
    routeFetch([
      { match: "api.propertydata.co.uk/uprns", status: 401, body: { status: "error", code: "X03" } },
      { match: "api.ideal-postcodes.co.uk", status: 401, body: { code: 4010, message: "Invalid Key" } },
      { match: "api.getaddress.io", body: { postcode: "SW6 5AA", addresses: [{ formatted_address: ["Flat 2", "8 Sample Road", "", "London", ""], postcode: "SW6 5AA" }] } },
    ]);
    const res = await invoke("SW6 5AA");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.addresses[0].address, "Flat 2, 8 Sample Road, London, SW6 5AA");
    assert.equal(logs.map((line) => JSON.parse(line).provider).join(","), "propertydata,ideal_postcodes");
    assert.equal(logs.join("\n").includes(GETADDRESS_SECRET), false);
  });

  test("a valid postcode with no premise lines confirms the district", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET });
    routeFetch([propertyDataSuccess([]), LONDON]);
    const res = await invoke("SW6 5AA");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.reason, "no_addresses");
    assert.deepEqual(res.body.addresses, []);
    assert.equal(res.body.locality, "Hammersmith and Fulham, London");
    assert.match(res.body.error, /No addresses were found/);
  });

  test("postcodes.io separates an unrecognised postcode from a provider outage", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET });
    routeFetch([
      { match: "api.propertydata.co.uk/uprns", status: 200, body: { status: "error", code: "X04" } },
      postcodesHit({ status: 404, error: "Invalid postcode" }, 404),
    ]);
    const res = await invoke("SW6 5AA");
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.reason, "invalid_postcode");
    assert.match(res.body.error, /not a recognised UK postcode/);
    assert.equal(JSON.parse(logs[0]).reason, "provider_quota");
  });

  test("rejects a partial postcode before calling a provider", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET });
    let called = false;
    globalThis.fetch = async () => { called = true; throw new Error("should not fetch"); };
    const res = await invoke("SW6");
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, "Enter a full UK postcode.");
    assert.equal(res.body.reason, "invalid_postcode");
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(called, false);
  });

  test("missing provider keys return 503", async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; throw new Error("should not fetch"); };
    const res = await invoke("SW6 5AA");
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, "Address search unavailable. Please enter your address manually.");
    assert.equal(res.body.reason, "not_configured");
    assert.equal(called, false);
  });

  test("rate limit and method guard stay in place", async () => {
    setEnv({ PROPERTYDATA_API_KEY: SECRET });
    routeFetch([propertyDataSuccess()]);
    const ip = nextIp();
    for (let i = 0; i < 12; i += 1) assert.equal((await invoke("SW6 5AA", { ip })).statusCode, 200);
    const limited = await invoke("SW6 5AA", { ip });
    assert.equal(limited.statusCode, 429);
    const res = mockRes();
    await handler({ method: "POST", query: { postcode: "SW6 5AA" }, headers: {} }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers["Cache-Control"], "no-store");
  });

  test("sold-price proxies prefer their historical key and fall back to the other name", async () => {
    assert.equal(propertyDataKey(), "");
    setEnv({ PROPERTYDATA_KEY: "legacy-first", PROPERTYDATA_API_KEY: "api-second" });
    assert.equal(propertyDataKey("PROPERTYDATA_KEY"), "legacy-first");
    assert.equal(propertyDataKey(), "api-second");
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return jsonResponse(200, { status: "no_data" });
    };
    for (const endpoint of [propertydata, propertydataAvm]) {
      const res = mockRes();
      await endpoint({ method: "GET", query: { postcode: "SW6 5AA" }, headers: {} }, res);
      assert.equal(res.statusCode, 200);
    }
    assert.match(calls[0], /key=legacy-first/);
    assert.match(calls[1], /key=legacy-first/);
    setEnv({ PROPERTYDATA_API_KEY: "api-only" });
    calls.length = 0;
    const res = mockRes();
    await propertydata({ method: "GET", query: { postcode: "SW6 5AA" }, headers: {} }, res);
    assert.match(calls[0], /key=api-only/);
    assert.equal(calls[0].includes("undefined"), false);
  });
});

describe("fact find address picker", { concurrency: 1 }, () => {
  function mount(fetchImpl) {
    const doc = { byId: {}, getElementById(id) { return this.byId[id] || null; } };
    const postcode = makeEl("security_postcode");
    const address = makeEl("security_address");
    const button = makeEl("findAddress");
    const choices = makeEl("addressChoices");
    const message = makeEl("addressMessage");
    const postcodeError = makeEl("e_security_postcode");
    const addressError = makeEl("e_security_address");
    button.textContent = "Find address";
    for (const el of [postcode, address, button, choices, message, postcodeError, addressError]) el.ownerDocument = doc;
    doc.byId[postcodeError.id] = postcodeError;
    doc.byId[addressError.id] = addressError;
    const picker = bindSecurityAddressPicker({ postcodeInput: postcode, addressInput: address, button, choices, message, fetchImpl });
    return { postcode, address, button, choices, message, postcodeError, addressError, picker };
  }

  test("wires a bold teal button, uppercases on entry, and searches with Enter", async () => {
    const html = readFileSync(root + "fact-find.html", "utf8");
    const js = readFileSync(root + "fact-find.js", "utf8");
    const buttonRule = html.match(/\.btn-teal\{([^}]+)\}/)[1];
    const background = buttonRule.match(/background:(#[0-9A-Fa-f]{3,8})/)[1];
    const color = buttonRule.match(/color:(#[0-9A-Fa-f]{3,8})/)[1];
    assert.ok(contrast(background, color) >= 4.5, `contrast ${contrast(background, color)}`);
    assert.match(buttonRule, /font-weight:700/);
    assert.match(buttonRule, /min-height:48px/);
    assert.match(html, /#findAddress,\.find-address\{width:100%/);
    assert.match(FINDER_MARKUP, /id="findAddress" class="btn btn-teal"/);
    assert.match(js, /bindSecurityAddressPicker/);
    assert.match(js, /bindPostcode\(postcode\)/);
    assert.doesNotMatch(js, /id="findAddress" style=/);
    assert.match(readFileSync(root + "lib/ff-properties-ui.js", "utf8"), /class="btn btn-teal find-address"/);

    const typed = makeEl("security_postcode");
    bindPostcode(typed);
    typed.value = "sw6 5aa";
    typed.selectionStart = 4;
    typed.dispatchEvent({ type: "input" });
    assert.equal(typed.value, "SW6 5AA");
    typed.dispatchEvent({ type: "blur" });
    assert.equal(typed.value, "SW6 5AA");

    let requested = "";
    const ui = mount(async (url) => {
      requested = url;
      return { ok: true, json: async () => ({ addresses: [{ address: '1 <Sample> & Co, London, SW6 5AA' }] }) };
    });
    ui.postcode.value = "sw6 5aa";
    let prevented = false;
    ui.postcode.dispatchEvent({ type: "keydown", key: "Enter", preventDefault() { prevented = true; } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(prevented, true);
    assert.equal(requested, "/api/address-lookup?postcode=SW6%205AA");
    assert.equal(ui.button.disabled, false);
    assert.equal(ui.button.textContent, "Find address");
    assert.match(ui.choices.innerHTML, /1 &lt;Sample&gt; &amp; Co/);
    assert.equal(ui.choices.disabled, false);
    assert.ok(ui.choices.size > 1);
  });

  test("shows a loading state, then copies the chosen address and clears its error", async () => {
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const ui = mount(() => pending);
    const pendingFind = ui.picker.find();
    await Promise.resolve();
    assert.equal(ui.button.disabled, true);
    assert.equal(ui.button.textContent, "Finding addresses…");
    assert.equal(ui.button.attrs["aria-busy"], "true");
    release({ ok: true, json: async () => ({ addresses: [{ address: "Flat 1, 10 Sample Street, London, SW6 5AA" }, { address: "Flat 2, 10 Sample Street, London, SW6 5AA" }] }) });
    await pendingFind;
    ui.address.classList.add("bad");
    ui.addressError.textContent = "Check the address";
    ui.postcode.classList.add("bad");
    ui.postcodeError.textContent = "Valid UK postcode required";
    ui.choices.value = "1";
    ui.choices.dispatchEvent({ type: "change" });
    assert.equal(ui.address.value, "Flat 2, 10 Sample Street, London, SW6 5AA");
    assert.equal(ui.address.classList.contains("bad"), false);
    assert.equal(ui.addressError.textContent, "");
    assert.equal(ui.postcode.classList.contains("bad"), false);
    assert.equal(ui.postcodeError.textContent, "");
    assert.match(ui.message.textContent, /Address added/);
  });

  test("keeps manual entry guided when the provider is down or the postcode is invalid", async () => {
    const down = mount(async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: "SW6 5AA is in Hammersmith and Fulham, London. Address search is unavailable just now. Please enter the building number and street manually.",
        reason: "provider_quota",
        locality: "Hammersmith and Fulham, London",
        postcode: "SW6 5AA",
        addresses: [],
      }),
    }));
    down.postcode.value = "SW6 5AA";
    down.address.value = "";
    await down.picker.find();
    assert.match(down.message.textContent, /Hammersmith and Fulham/);
    assert.match(down.message.textContent, /manually/);
    assert.equal(down.message.classList.contains("is-guide"), true);
    assert.equal(down.choices.disabled, true);
    assert.match(down.choices.innerHTML, /enter it manually/);
    assert.match(down.address.placeholder, /Building number and street/);
    assert.equal(down.address.disabled, false);
    assert.equal(down.address.focused, true);
    assert.equal(down.button.disabled, false);

    const invalid = mount(async () => ({ ok: false, status: 400, json: async () => ({ error: "Enter a full UK postcode.", reason: "invalid_postcode" }) }));
    invalid.postcode.value = "SW6";
    await invalid.picker.find();
    assert.equal(invalid.message.classList.contains("is-error"), true);
    assert.equal(invalid.postcode.classList.contains("bad"), true);
    assert.equal(invalid.postcodeError.textContent, "Enter a full UK postcode.");
    assert.equal(invalid.address.disabled, false);
  });
});
