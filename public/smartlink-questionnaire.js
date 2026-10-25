// Staging-only borrower completion UI. No local storage or staff fields.
export function parseAnswer(field, raw) {
  if (raw.trim() === '') throw new Error('Please complete this answer.');
  if (field.type === 'boolean') {
    if (!['true', 'false'].includes(raw)) throw new Error('Choose Yes or No.');
    return raw === 'true';
  }
  if (field.type === 'currency' || field.type === 'number') {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid amount of zero or more.');
    return value;
  }
  if (field.choices && !field.choices.includes(raw)) throw new Error('Choose an available option.');
  return raw.trim();
}

export function createSession(endpoint, fetcher = fetch, newId = () => crypto.randomUUID()) {
  let view, pending;
  const read = async () => {
    const response = await fetcher(endpoint, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load your case. Reopen your private link to verify access.');
    view = await response.json();
    return view;
  };
  return {
    read,
    async save(fields) {
      if (!view) throw new Error('Load your case first.');
      // After uncertain transport failure retry the identical payload/key only.
      pending ||= { expected_version: view.version, idempotency_key: newId(), fields };
      const response = await fetcher(endpoint, { method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      if (response.status === 409) {
        pending = undefined;
        return { conflict: true };
      }
      if (!response.ok) throw new Error('Save not confirmed. Your answers remain here; retry to check and save safely.');
      const result = await response.json();
      if (result.rejected?.length) throw new Error('Some answers were not accepted. Please contact your broker.');
      // A replay response contains no case fields. Always reload authoritative state.
      const refreshed = await read();
      pending = undefined;
      return { view: refreshed };
    }
  };
}

function mount(root) {
  const session = createSession(root.dataset.endpoint);
  const el = (tag, text, attrs = {}) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const nice = value => String(value).replaceAll('_', ' ');
  async function load() {
    try { render(await session.read()); }
    catch (error) { root.replaceChildren(el('h1', 'Your next steps'), el('p', error.message, { role: 'alert' })); }
  }
  function render(view) {
    root.replaceChildren(el('p', 'YOUR CASE', { class: 'eyebrow' }), el('h1', 'Your next steps'));
    root.append(el('p', 'We’ve kept the information already provided. Complete the missing answers below.'));
    const held = Object.entries(view.fields || {}).filter(([, entry]) => entry.value !== null && entry.value !== undefined && entry.value !== '');
    const details = el('details');
    details.append(el('summary', `Information already held (${held.length})`));
    const list = el('dl');
    for (const [key, entry] of held) {
      list.append(el('dt', nice(key)), el('dd', entry.value === false ? 'No' : entry.value === true ? 'Yes' : String(entry.value)));
    }
    details.append(list); root.append(details);
    root.append(el('p', `${view.progress.answered} of ${view.progress.total} mapped answers held`));
    const batch = view.batch || [];
    if (!batch.length) {
      root.append(el('h2', view.progress.total > 0 && view.progress.answered === view.progress.total ? 'Answers saved for review' : 'Your broker will review the next step'),
        el('p', 'You can return using this private link. Your broker will confirm what happens next.'));
      return;
    }
    const form = el('form');
    const fieldset = el('fieldset'); fieldset.style.border = '0'; fieldset.style.padding = '0';
    for (const field of batch) {
      const row = el('div', undefined, { class: 'sl-field' });
      const id = 'answer-' + field.key;
      row.append(el('label', field.label, { for: id }));
      let input;
      if (field.type === 'boolean' || field.choices) {
        input = el('select', undefined, { id, name: field.key, required: '' });
        input.append(el('option', 'Choose…', { value: '' }));
        const options = field.type === 'boolean' ? [['true', 'Yes'], ['false', 'No']] : field.choices.map(v => [v, nice(v)]);
        for (const [value, label] of options) input.append(el('option', label, { value }));
      } else {
        input = el('input', undefined, { id, name: field.key, required: '', type: ['currency', 'number'].includes(field.type) ? 'number' : field.type || 'text' });
        if (['currency', 'number'].includes(field.type)) { input.min = '0'; input.step = 'any'; }
      }
      input.style.width = '100%'; input.style.padding = '12px';
      row.append(input); fieldset.append(row);
    }
    const status = el('p', '', { role: 'status', 'aria-live': 'polite' });
    const save = el('button', 'Save and continue', { type: 'submit', class: 'button' });
    const reload = el('button', 'Load latest saved answers', { type: 'button', hidden: '' });
    reload.addEventListener('click', load);
    form.append(fieldset, status, save, reload);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const fields = {};
      try { for (const field of batch) fields[field.key] = parseAnswer(field, form.elements.namedItem(field.key).value); }
      catch (error) { status.textContent = error.message; return; }
      fieldset.disabled = true; save.disabled = true; status.textContent = 'Saving…';
      try {
        const result = await session.save(fields);
        if (result.conflict) {
          status.textContent = 'Your case changed elsewhere. These answers have not been saved. Copy any changes you need, then load the latest saved answers before continuing.';
          reload.hidden = false;
          return;
        }
        render(result.view);
      } catch (error) {
        status.textContent = error.message;
        // Keep fields locked so a retry cannot silently send a different payload.
        save.textContent = 'Retry save'; save.disabled = false;
      }
    });
    root.append(form);
  }
  load();
}
if (typeof document !== 'undefined') {
  const root = document.getElementById('smartlink-questionnaire');
  if (root) mount(root);
}
