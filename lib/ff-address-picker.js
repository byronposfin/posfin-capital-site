// Fact-find security postcode picker. Credentials stay on /api/address-lookup.
export const FINDER_MARKUP = '<button type="button" id="findAddress" class="btn btn-teal">Find address</button><label class="l address-choices-label" for="addressChoices">Choose your address</label><select id="addressChoices" disabled><option value="">Enter a postcode, then choose Find address</option></select><p id="addressMessage" class="address-message" role="status" aria-live="polite"></p>';

const DEFAULT_PLACEHOLDER = "Select an address above or enter it manually";
const BUTTON_LABEL = "Find address";

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function fieldError(input) {
  const doc = input && input.ownerDocument;
  if (!doc || typeof doc.getElementById !== "function" || !input.id) return null;
  return doc.getElementById("e_" + input.id);
}

function clearFieldError(input) {
  if (!input) return;
  input.classList.remove("bad");
  const error = fieldError(input);
  if (error) error.textContent = "";
}

export function bindSecurityAddressPicker({ postcodeInput, addressInput, button, choices, message, fetchImpl } = {}) {
  let rows = [];
  let version = 0;
  const fetchFn = fetchImpl || ((...args) => globalThis.fetch(...args));

  function setMessage(text, tone) {
    message.textContent = text || "";
    message.classList.remove("is-guide", "is-error");
    if (tone === "error") message.classList.add("is-error");
    else if (tone === "guide") message.classList.add("is-guide");
  }

  function restoreButton() {
    button.disabled = false;
    if (typeof button.removeAttribute === "function") button.removeAttribute("aria-busy");
    button.textContent = button.dataset.label || BUTTON_LABEL;
  }

  function resetChoices() {
    version += 1;
    rows = [];
    choices.disabled = true;
    choices.size = 1;
    choices.innerHTML = '<option value="">Find addresses for this postcode</option>';
    setMessage("");
    if (addressInput) addressInput.placeholder = DEFAULT_PLACEHOLDER;
    restoreButton();
  }

  function applyAddress(address) {
    if (!addressInput || !address) return;
    addressInput.value = address;
    clearFieldError(addressInput);
    clearFieldError(postcodeInput);
    addressInput.dispatchEvent(new Event("input", { bubbles: true }));
    addressInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function find() {
    const pc = String(postcodeInput.value || "").trim().toUpperCase();
    const current = ++version;
    button.disabled = true;
    if (typeof button.setAttribute === "function") button.setAttribute("aria-busy", "true");
    button.dataset.label = BUTTON_LABEL;
    button.textContent = "Finding addresses…";
    choices.disabled = true;
    choices.size = 1;
    setMessage("Finding addresses…", "guide");
    try {
      const response = await fetchFn("/api/address-lookup?postcode=" + encodeURIComponent(pc));
      let result = {};
      try { result = await response.json(); } catch { result = {}; }
      if (current !== version) return;
      const addresses = Array.isArray(result.addresses) ? result.addresses.filter((row) => row && row.address) : [];
      if (response.ok && addresses.length) {
        rows = addresses;
        choices.innerHTML = '<option value="">Select your address</option>' + addresses.map((row, index) => `<option value="${index}">${escapeHtml(row.address)}</option>`).join("");
        choices.disabled = false;
        choices.size = Math.min(8, addresses.length + 1);
        clearFieldError(postcodeInput);
        if (addressInput) addressInput.placeholder = DEFAULT_PLACEHOLDER;
        setMessage("Choose from the list, or enter your address manually below.", "guide");
        return;
      }
      rows = [];
      const reason = result.reason || (response.ok ? "no_addresses" : "provider_unavailable");
      const unavailable = !response.ok && reason !== "invalid_postcode" && reason !== "no_addresses";
      choices.innerHTML = unavailable
        ? '<option value="">Address list unavailable — enter it manually</option>'
        : '<option value="">No addresses found — enter it manually</option>';
      choices.disabled = true;
      choices.size = 1;
      if (reason === "invalid_postcode") {
        const text = result.error || "Enter a full UK postcode.";
        setMessage(text, "error");
        postcodeInput.classList.add("bad");
        const error = fieldError(postcodeInput);
        if (error) error.textContent = text;
        return;
      }
      const locality = String(result.locality || "").trim();
      const shown = String(result.postcode || pc).trim();
      const guidance = result.error || (locality
        ? `${shown} is in ${locality}. Please enter the building number and street manually.`
        : "Address search is unavailable. Please enter your address manually.");
      setMessage(guidance, "guide");
      clearFieldError(postcodeInput);
      if (addressInput) {
        addressInput.placeholder = locality ? `Building number and street, ${locality}` : "Enter the building number and street manually";
        if (!addressInput.value && typeof addressInput.focus === "function") addressInput.focus();
      }
    } catch {
      if (current !== version) return;
      rows = [];
      choices.disabled = true;
      choices.size = 1;
      choices.innerHTML = '<option value="">Address list unavailable — enter it manually</option>';
      setMessage("Address search is unavailable. Please enter your address manually.", "error");
    } finally {
      if (current === version) restoreButton();
    }
  }

  postcodeInput.addEventListener("input", resetChoices);
  postcodeInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    if (!button.disabled) find();
  });
  button.addEventListener("click", () => { find(); });
  choices.addEventListener("change", () => {
    const selected = rows[choices.value];
    if (!selected) return;
    applyAddress(selected.address);
    setMessage("Address added. You can still edit it below.", "guide");
  });

  return { find, resetChoices };
}
