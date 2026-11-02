import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

// === FIELD TYPES (from old QuickBuilder shim) ===
const RAW_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "boolean",
  "date",
  "json",
  "radio",
  "dropdown",
  "select",
  "multiselect",
  "relation",
  "checkbox",
  "relationship",
  "email",
  "phone",
  "url",
  "address",
  "rich_text",
  "name",
  "datetime",
  "daterange",
  "time",
  "price",
  "image",
  "file",
  "video",
  "color",
  "video_embed",
  "iframe_embed",
  "tags",
  "relation_user",
  "taxonomy",
  "repeater",
  "panels",
];

function labelFromFieldType(type) {
  switch (type) {
    case "rich_text":
      return "Rich text";
    case "boolean":
      return "Toggle";
    case "datetime":
      return "Date & time";
    case "daterange":
      return "Date range";
    case "video_embed":
      return "Video embed";
    case "iframe_embed":
      return "Iframe embed";
    case "relation_user":
      return "User relation";
    case "repeater":
      return "Repeater";
    case "panels":
      return "Panels (page sections)";
    default:
      return type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
  }
}

const FIELD_TYPES = RAW_FIELD_TYPES.map((t) => ({
  value: t,
  label: labelFromFieldType(t),
}));

const STARTER_PANEL_CONFIG = {
  addLabel: "Add Panel",
  definitions: [
    { key: "hero", label: "Hero", description: "Large opening section with an image and calls to action.", fields: [
      { field_key: "eyebrow", label: "Eyebrow", type: "text" },
      { field_key: "heading", label: "Heading", type: "text", required: true },
      { field_key: "body", label: "Body", type: "rich_text" },
      { field_key: "image", label: "Hero image", type: "image" },
      { field_key: "primary_label", label: "Primary button label", type: "text" },
      { field_key: "primary_url", label: "Primary button URL", type: "url" },
      { field_key: "secondary_label", label: "Secondary button label", type: "text" },
      { field_key: "secondary_url", label: "Secondary button URL", type: "url" }
    ]},
    { key: "rich_text", label: "Rich Text", description: "A writing-focused content section.", fields: [
      { field_key: "heading", label: "Heading", type: "text" },
      { field_key: "body", label: "Body", type: "rich_text", required: true }
    ]},
    { key: "image_text", label: "Image + Text", description: "An image beside formatted text.", fields: [
      { field_key: "heading", label: "Heading", type: "text" },
      { field_key: "body", label: "Body", type: "rich_text" },
      { field_key: "image", label: "Image", type: "image" },
      { field_key: "alignment", label: "Image position", type: "select", config: { choices: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] } }
    ]},
    { key: "cta", label: "Call to Action", description: "A focused message with a button.", fields: [
      { field_key: "heading", label: "Heading", type: "text", required: true },
      { field_key: "body", label: "Body", type: "rich_text" },
      { field_key: "button_label", label: "Button label", type: "text" },
      { field_key: "button_url", label: "Button URL", type: "url" }
    ]},
    { key: "contact_intro", label: "Contact Intro", description: "Introductory contact information.", fields: [
      { field_key: "heading", label: "Heading", type: "text" },
      { field_key: "body", label: "Body", type: "rich_text" },
      { field_key: "phone", label: "Phone", type: "phone" },
      { field_key: "email", label: "Email", type: "email" }
    ]}
  ],
  templates: [
    { key: "standard", label: "Standard Page", allowed: ["rich_text", "image_text", "cta"], fixed: false },
    { key: "homepage", label: "Homepage", allowed: ["hero", "image_text", "rich_text", "cta"], fixed: false, defaults: ["hero"] },
    { key: "about", label: "About Page", allowed: ["hero", "image_text", "rich_text", "cta"], fixed: false },
    { key: "contact", label: "Contact Page", allowed: ["hero", "contact_intro", "rich_text", "cta"], fixed: false, defaults: ["contact_intro"] }
  ]
};

function JsonConfigTextarea({ value, onChange, rows = 12 }) {
  const [text, setText] = useState(() => JSON.stringify(value || [], null, 2));
  const [valid, setValid] = useState(true);
  useEffect(() => setText(JSON.stringify(value || [], null, 2)), [value]);
  return <div>
    <textarea className="su-input" rows={rows} value={text} onChange={(e) => {
      const next = e.target.value;
      setText(next);
      try { onChange(JSON.parse(next)); setValid(true); } catch { setValid(false); }
    }} />
    <div className="text-[11px]" style={{ color: valid ? "#166534" : "#b91c1c" }}>
      {valid ? "Valid configuration" : "Invalid JSON — changes are not saved yet"}
    </div>
  </div>;
}

function panelKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function moveItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function PanelsConfigBuilder({ config, onChange }) {
  const cfg = config && typeof config === "object" ? config : {};
  const definitions = Array.isArray(cfg.definitions) ? cfg.definitions : [];
  const templates = Array.isArray(cfg.templates) ? cfg.templates : [];
  const [openPanels, setOpenPanels] = useState({});
  const [openTemplates, setOpenTemplates] = useState({});

  const save = (patch) => onChange({ ...cfg, ...patch });
  const saveDefinitions = (next) => save({ definitions: next });
  const saveTemplates = (next) => save({ templates: next });

  function updateDefinition(index, patch) {
    const next = [...definitions];
    next[index] = { ...next[index], ...patch };
    saveDefinitions(next);
  }
  function addDefinition() {
    const next = [...definitions, { key: `panel_${definitions.length + 1}`, label: "New Panel", description: "", fields: [] }];
    saveDefinitions(next);
    setOpenPanels((prev) => ({ ...prev, [next.length - 1]: true }));
  }
  function removeDefinition(index) {
    const removedKey = definitions[index]?.key;
    onChange({ ...cfg, definitions: definitions.filter((_, i) => i !== index), templates: templates.map((template) => ({
      ...template,
      allowed: (template.allowed || []).filter((key) => key !== removedKey),
      defaults: (template.defaults || []).filter((key) => key !== removedKey),
      slots: (template.slots || []).filter((key) => key !== removedKey),
    })) });
  }
  function renameDefinitionKey(index, rawKey) {
    const oldKey = definitions[index]?.key;
    const newKey = panelKey(rawKey);
    const nextDefinitions = [...definitions];
    nextDefinitions[index] = { ...nextDefinitions[index], key: newKey };
    const replaceKey = (items) => (items || []).map((key) => key === oldKey ? newKey : key);
    onChange({
      ...cfg,
      definitions: nextDefinitions,
      templates: templates.map((template) => ({
        ...template,
        allowed: replaceKey(template.allowed),
        defaults: replaceKey(template.defaults),
        slots: replaceKey(template.slots),
      })),
    });
  }
  function updatePanelField(panelIndex, fieldIndex, patch) {
    const fields = [...(definitions[panelIndex]?.fields || [])];
    fields[fieldIndex] = { ...fields[fieldIndex], ...patch };
    updateDefinition(panelIndex, { fields });
  }
  function addPanelField(panelIndex) {
    const fields = [...(definitions[panelIndex]?.fields || []), {
      field_key: `field_${(definitions[panelIndex]?.fields || []).length + 1}`,
      label: "New field",
      type: "text",
      required: false,
      help_text: "",
      config: {},
    }];
    updateDefinition(panelIndex, { fields });
  }

  function updateTemplate(index, patch) {
    const next = [...templates];
    next[index] = { ...next[index], ...patch };
    saveTemplates(next);
  }
  function addTemplate() {
    const next = [...templates, { key: `template_${templates.length + 1}`, label: "New Page Template", description: "", fixed: false, allowed: definitions.map((d) => d.key), defaults: [] }];
    saveTemplates(next);
    setOpenTemplates((prev) => ({ ...prev, [next.length - 1]: true }));
  }
  function toggleTemplateKey(index, property, key) {
    const current = Array.isArray(templates[index]?.[property]) ? templates[index][property] : [];
    updateTemplate(index, { [property]: current.includes(key) ? current.filter((item) => item !== key) : [...current, key] });
  }

  return <div className="qb-panels-builder">
    <div className="qb-panels-heading">
      <div>
        <h3>Panel Types</h3>
        <p>Create the sections that can appear on a page, then add the fields each section needs.</p>
      </div>
      <div className="su-flex su-gap-sm su-flex-wrap">
        <button type="button" className="su-btn" onClick={() => {
          if ((definitions.length || templates.length) && !window.confirm("Replace the current Panel Types and Page Templates with the starter set?")) return;
          onChange(JSON.parse(JSON.stringify(STARTER_PANEL_CONFIG)));
        }}>Install starter set</button>
        <button type="button" className="su-btn primary" onClick={addDefinition}>+ Add Panel Type</button>
      </div>
    </div>

    {!definitions.length && <div className="qb-panels-empty">No Panel Types yet. Add one or install the starter set.</div>}
    <div className="qb-panel-definitions">
      {definitions.map((definition, panelIndex) => {
        const open = openPanels[panelIndex] !== false;
        return <section className="qb-panel-definition" key={`${definition.key}-${panelIndex}`}>
          <header>
            <button type="button" className="qb-panel-toggle" onClick={() => setOpenPanels((prev) => ({ ...prev, [panelIndex]: !open }))}>
              <span>{open ? "▾" : "▸"}</span><strong>{definition.label || definition.key || "Untitled Panel"}</strong><code>{definition.key}</code>
            </button>
            <div className="su-flex su-gap-xs">
              <button type="button" className="su-btn" disabled={panelIndex === 0} onClick={() => saveDefinitions(moveItem(definitions, panelIndex, -1))}>↑</button>
              <button type="button" className="su-btn" disabled={panelIndex === definitions.length - 1} onClick={() => saveDefinitions(moveItem(definitions, panelIndex, 1))}>↓</button>
              <button type="button" className="su-btn" onClick={() => {
                const copy = JSON.parse(JSON.stringify(definition));
                copy.key = `${definition.key || "panel"}_copy`;
                copy.label = `${definition.label || "Panel"} Copy`;
                const next = [...definitions]; next.splice(panelIndex + 1, 0, copy); saveDefinitions(next);
              }}>Duplicate</button>
              <button type="button" className="su-btn" onClick={() => removeDefinition(panelIndex)}>Remove</button>
            </div>
          </header>
          {open && <div className="qb-panel-definition-body">
            <div className="qb-panel-meta-grid">
              <label><span>Panel name</span><input className="su-input" value={definition.label || ""} onChange={(e) => updateDefinition(panelIndex, { label: e.target.value, key: definition.key || panelKey(e.target.value) })} /></label>
              <label><span>Technical key</span><input className="su-input" value={definition.key || ""} onChange={(e) => renameDefinitionKey(panelIndex, e.target.value)} /></label>
              <label className="qb-panel-description"><span>Description</span><input className="su-input" value={definition.description || ""} onChange={(e) => updateDefinition(panelIndex, { description: e.target.value })} /></label>
            </div>
            <div className="qb-panel-fields-header"><strong>Fields</strong><button type="button" className="su-btn primary" onClick={() => addPanelField(panelIndex)}>+ Add Field</button></div>
            {!(definition.fields || []).length && <p className="su-text-sm su-text-muted">No fields in this Panel yet.</p>}
            <div className="qb-panel-field-list">
              {(definition.fields || []).map((field, fieldIndex) => <div className="qb-panel-field-row" key={`${field.field_key}-${fieldIndex}`}>
                <span className="qb-panel-field-order">{fieldIndex + 1}</span>
                <input className="su-input" aria-label="Field label" placeholder="Label" value={field.label || ""} onChange={(e) => updatePanelField(panelIndex, fieldIndex, { label: e.target.value, field_key: field.field_key || panelKey(e.target.value) })} />
                <input className="su-input" aria-label="Field key" placeholder="field_key" value={field.field_key || ""} onChange={(e) => updatePanelField(panelIndex, fieldIndex, { field_key: panelKey(e.target.value) })} />
                <select className="su-select" aria-label="Field type" value={field.type || "text"} onChange={(e) => updatePanelField(panelIndex, fieldIndex, { type: e.target.value })}>
                  {FIELD_TYPES.filter((item) => item.value !== "panels").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <label className="qb-panel-required"><input type="checkbox" checked={!!field.required} onChange={(e) => updatePanelField(panelIndex, fieldIndex, { required: e.target.checked })} /> Required</label>
                <input className="su-input" aria-label="Help text" placeholder="Help text" value={field.help_text || ""} onChange={(e) => updatePanelField(panelIndex, fieldIndex, { help_text: e.target.value })} />
                <div className="qb-panel-field-actions">
                  <button type="button" className="su-btn" disabled={fieldIndex === 0} onClick={() => updateDefinition(panelIndex, { fields: moveItem(definition.fields || [], fieldIndex, -1) })}>↑</button>
                  <button type="button" className="su-btn" disabled={fieldIndex === (definition.fields || []).length - 1} onClick={() => updateDefinition(panelIndex, { fields: moveItem(definition.fields || [], fieldIndex, 1) })}>↓</button>
                  <button type="button" className="su-btn" onClick={() => {
                    const fields = [...(definition.fields || [])];
                    const copy = JSON.parse(JSON.stringify(field));
                    copy.field_key = `${field.field_key || "field"}_copy`;
                    copy.label = `${field.label || "Field"} Copy`;
                    fields.splice(fieldIndex + 1, 0, copy);
                    updateDefinition(panelIndex, { fields });
                  }}>Duplicate</button>
                  <button type="button" className="su-btn" onClick={() => updateDefinition(panelIndex, { fields: (definition.fields || []).filter((_, i) => i !== fieldIndex) })}>Remove</button>
                </div>
                <details className="qb-panel-field-config"><summary>Advanced field configuration</summary><JsonConfigTextarea value={field.config || {}} onChange={(fieldConfig) => updatePanelField(panelIndex, fieldIndex, { config: fieldConfig })} rows={5} /></details>
              </div>)}
            </div>
          </div>}
        </section>;
      })}
    </div>

    <div className="qb-panels-heading qb-templates-heading">
      <div><h3>Page Templates</h3><p>Choose which Panels each page may use. Flexible templates allow rearranging; fixed templates define exact slots.</p></div>
      <button type="button" className="su-btn primary" onClick={addTemplate}>+ Add Page Template</button>
    </div>
    {!templates.length && <div className="qb-panels-empty">No Page Templates yet.</div>}
    <div className="qb-panel-definitions">
      {templates.map((template, templateIndex) => {
        const open = openTemplates[templateIndex] !== false;
        return <section className="qb-panel-definition" key={`${template.key}-${templateIndex}`}>
          <header>
            <button type="button" className="qb-panel-toggle" onClick={() => setOpenTemplates((prev) => ({ ...prev, [templateIndex]: !open }))}>
              <span>{open ? "▾" : "▸"}</span><strong>{template.label || template.key || "Untitled Template"}</strong><code>{template.fixed ? "Fixed" : "Flexible"}</code>
            </button>
            <div className="su-flex su-gap-xs">
              <button type="button" className="su-btn" disabled={templateIndex === 0} onClick={() => saveTemplates(moveItem(templates, templateIndex, -1))}>↑</button>
              <button type="button" className="su-btn" disabled={templateIndex === templates.length - 1} onClick={() => saveTemplates(moveItem(templates, templateIndex, 1))}>↓</button>
              <button type="button" className="su-btn" onClick={() => saveTemplates(templates.filter((_, i) => i !== templateIndex))}>Remove</button>
            </div>
          </header>
          {open && <div className="qb-panel-definition-body">
            <div className="qb-panel-meta-grid">
              <label><span>Template name</span><input className="su-input" value={template.label || ""} onChange={(e) => updateTemplate(templateIndex, { label: e.target.value, key: template.key || panelKey(e.target.value) })} /></label>
              <label><span>Technical key</span><input className="su-input" value={template.key || ""} onChange={(e) => updateTemplate(templateIndex, { key: panelKey(e.target.value) })} /></label>
              <label className="qb-panel-description"><span>Description</span><input className="su-input" value={template.description || ""} onChange={(e) => updateTemplate(templateIndex, { description: e.target.value })} /></label>
            </div>
            <label className="qb-template-fixed"><input type="checkbox" checked={!!template.fixed} onChange={(e) => updateTemplate(templateIndex, { fixed: e.target.checked, slots: e.target.checked ? (template.slots || []) : template.slots })} /> Lock this template to a fixed Panel structure</label>
            {!template.fixed ? <div className="qb-template-options">
              <div><strong>Allowed Panels</strong><p>Select what editors can add to pages using this template.</p>{definitions.map((definition) => <label key={definition.key}><input type="checkbox" checked={(template.allowed || []).includes(definition.key)} onChange={() => toggleTemplateKey(templateIndex, "allowed", definition.key)} /> {definition.label || definition.key}</label>)}</div>
              <div><strong>Default Panels</strong><p>These are added automatically to a new empty page.</p>{definitions.filter((definition) => (template.allowed || []).includes(definition.key)).map((definition) => <label key={definition.key}><input type="checkbox" checked={(template.defaults || []).includes(definition.key)} onChange={() => toggleTemplateKey(templateIndex, "defaults", definition.key)} /> {definition.label || definition.key}</label>)}</div>
            </div> : <div className="qb-template-slots">
              <div className="qb-panel-fields-header"><div><strong>Fixed Panel slots</strong><p>Editors can change content but cannot add, remove, or reorder these slots.</p></div><button type="button" className="su-btn primary" disabled={!definitions.length} onClick={() => updateTemplate(templateIndex, { slots: [...(template.slots || []), definitions[0]?.key] })}>+ Add Slot</button></div>
              {(template.slots || []).map((slot, slotIndex) => <div className="qb-template-slot" key={`${slot}-${slotIndex}`}><span>{slotIndex + 1}</span><select className="su-select" value={slot} onChange={(e) => { const slots = [...(template.slots || [])]; slots[slotIndex] = e.target.value; updateTemplate(templateIndex, { slots }); }}>{definitions.map((definition) => <option key={definition.key} value={definition.key}>{definition.label || definition.key}</option>)}</select><button type="button" className="su-btn" disabled={slotIndex === 0} onClick={() => updateTemplate(templateIndex, { slots: moveItem(template.slots || [], slotIndex, -1) })}>↑</button><button type="button" className="su-btn" disabled={slotIndex === (template.slots || []).length - 1} onClick={() => updateTemplate(templateIndex, { slots: moveItem(template.slots || [], slotIndex, 1) })}>↓</button><button type="button" className="su-btn" onClick={() => updateTemplate(templateIndex, { slots: (template.slots || []).filter((_, i) => i !== slotIndex) })}>Remove</button></div>)}
            </div>}
          </div>}
        </section>;
      })}
    </div>

    <details className="qb-panels-advanced">
      <summary>Advanced JSON</summary>
      <p>Use this only for configuration that is not yet exposed in the visual builder.</p>
      <label><strong>Panel definitions</strong><JsonConfigTextarea value={definitions} onChange={(next) => saveDefinitions(next)} rows={14} /></label>
      <label><strong>Page templates</strong><JsonConfigTextarea value={templates} onChange={(next) => saveTemplates(next)} rows={10} /></label>
    </details>
  </div>;
}

// === SUBFIELDS SUPPORT (name/address/media) ===
const SUBFIELD_MAP = {
  name: {
    title: "Title",
    first: "First",
    middle: "Middle",
    last: "Last",
    suffix: "Suffix",
  },
  address: {
    line1: "Address line 1",
    line2: "Address line 2",
    city: "City",
    state: "State / Province",
    postal: "ZIP / Postal",
    country: "Country",
  },
  image: {
    alt: "Alt text",
    title: "Title",
    caption: "Caption",
    credit: "Credit",
  },
  file: {
    title: "Title",
    caption: "Caption",
    credit: "Credit",
  },
  video: {
    title: "Title",
    caption: "Caption",
    credit: "Credit",
  },
};

function supportsSubfields(type) {
  return !!SUBFIELD_MAP[String(type || "").toLowerCase()];
}

function normalizeSubfieldsConfig(config, type) {
  const t = String(type || "").toLowerCase();
  const schema = SUBFIELD_MAP[t] || null;
  const base = config && typeof config === "object" ? { ...config } : {};
  if (!schema) return base;

  const out = { ...base };
  if (!out.subfields || typeof out.subfields !== "object") out.subfields = {};

  // ensure each known subfield exists
  for (const [key, defaultLabel] of Object.entries(schema)) {
    const row = out.subfields[key] || {};
    const show = row.show === undefined ? true : !!row.show;
    const label =
      typeof row.label === "string" && row.label.length
        ? row.label
        : defaultLabel;
    out.subfields[key] = { show, label };
  }

  // prune unknown keys
  for (const key of Object.keys(out.subfields)) {
    if (!schema[key]) delete out.subfields[key];
  }

  return out;
}

function SubfieldControls({ type, config, onChange }) {
  const t = String(type || "").toLowerCase();
  const schema = SUBFIELD_MAP[t] || null;
  if (!schema) return null;

  const normalized = normalizeSubfieldsConfig(config, t);

  function updateRow(key, patch) {
    const next = normalizeSubfieldsConfig(normalized, t);
    next.subfields[key] = { ...next.subfields[key], ...patch };
    onChange(next);
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Subfields
      </div>

      <div className="grid grid-cols-[120px,60px,1fr] gap-2 text-xs items-center">
        <div className="font-medium text-gray-500">Key</div>
        <div className="font-medium text-gray-500">Show</div>
        <div className="font-medium text-gray-500">Label</div>

        {Object.entries(schema).map(([key, defaultLabel]) => {
          const row = normalized.subfields[key] || {
            show: true,
            label: defaultLabel,
          };
          return (
            <React.Fragment key={key}>
              <div>
                <code>{key}</code>
              </div>
              <div>
                <input
                  type="checkbox"
                  checked={!!row.show}
                  onChange={(e) =>
                    updateRow(key, { show: !!e.target.checked })
                  }
                />
              </div>
              <div>
                <input
                  className="su-input su-input-xs"
                  value={row.label}
                  onChange={(e) => updateRow(key, { label: e.target.value })}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// === DEFAULT TYPE MODEL ===
const EMPTY_TYPE = {
  id: null,
  slug: "",
  type: "content",
  label_singular: "",
  label_plural: "",
  description: "",
  icon: "",
};

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e?.message || "Invalid JSON" };
  }
}

export default function QuickBuilderPage() {
  const [types, setTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [editingType, setEditingType] = useState(EMPTY_TYPE);
  const [isNewType, setIsNewType] = useState(false);

  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState(null);

  const [savingType, setSavingType] = useState(false);
  const [savingFields, setSavingFields] = useState(false);

  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Load all content types on mount
  useEffect(() => {
    let cancelled = false;

    async function loadTypes() {
      try {
        setLoadingTypes(true);
        setError("");
        const data = await api.get("/api/content-types");
        if (cancelled) return;
        setTypes(data || []);

        if ((data || []).length && !selectedTypeId) {
          setSelectedTypeId(data[0].id);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load content types");
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    }

    loadTypes();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load fields when selectedTypeId changes
  useEffect(() => {
    if (!selectedTypeId) {
      setFields([]);
      if (!isNewType) {
        setEditingType(EMPTY_TYPE);
      }
      setActiveFieldIndex(null);
      return;
    }

    let cancelled = false;

    async function loadTypeAndFields() {
      try {
        setLoadingFields(true);
        setError("");
        const data = await api.get(`/api/content-types/${selectedTypeId}`);
        if (cancelled) return;

        setEditingType({
          id: data.id,
          slug: data.slug || "",
          type: data.type || "content",
          label_singular: data.label_singular || "",
          label_plural: data.label_plural || "",
          description: data.description || "",
          icon: data.icon || "",
        });

        setFields(
          (data.fields || []).map((f) => {
            const rawType = String(f.type || "text").toLowerCase();

            // Backward/forward compatibility:
            // - older imports used "select" for dropdowns
            // - keep "dropdown" as canonical in the admin
            const normalizedType =
              rawType === "select"
                ? "dropdown"
                : rawType === "relationship"
                ? "relation"
                : rawType;

            const cfg = f.config || {};
            const normalizedConfig = {
              ...cfg,
              // Support both shapes:
              // - config.choices (canonical)
              // - config.options (older)
              choices: cfg.choices ?? cfg.options ?? null,
              options: cfg.options ?? cfg.choices ?? null,
            };

            return {
              id: f.id,
              field_key: f.field_key,
              label: f.label,
              type: normalizedType,
              required: !!f.required,
              help_text: f.help_text || "",
              order_index:
                typeof f.order_index === "number" ? f.order_index : 0,
              config: normalizedConfig,
            };
          })
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load content type");
        }
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    }

    if (!isNewType) {
      loadTypeAndFields();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, isNewType]);

  // ==== TYPE HANDLERS ====
  function startNewType() {
    setError("");
    setSaveMessage("");
    setIsNewType(true);
    setSelectedTypeId(null);
    setEditingType(EMPTY_TYPE);
    setFields([]);
    setActiveFieldIndex(null);
  }

  function handleTypeChange(key, value) {
    setEditingType((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveType(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    setSaveMessage("");

    let {
      slug,
      label_singular,
      label_plural,
      type,
      description,
      icon,
      id,
    } = editingType;

    const trimmedSingular = (label_singular || "").trim();
    let trimmedPlural = (label_plural || "").trim();

    if (!trimmedPlural && trimmedSingular) {
      trimmedPlural = trimmedSingular.endsWith("s")
        ? trimmedSingular
        : `${trimmedSingular}s`;
    }

    let finalSlug = (slug || "").trim();
    if (!finalSlug && trimmedPlural) {
      finalSlug = trimmedPlural
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    if (!finalSlug || !trimmedSingular || !trimmedPlural) {
      setError("Slug, singular label, and plural label are required.");
      return;
    }

    try {
      setSavingType(true);

      let saved;
      if (isNewType || !id) {
        saved = await api.post("/api/content-types", {
          slug: finalSlug,
          type: type || "content",
          label_singular: trimmedSingular,
          label_plural: trimmedPlural,
          description: description || "",
          icon: icon || "",
        });
      } else {
        saved = await api.put(`/api/content-types/${id}`, {
          slug: finalSlug,
          type: type || "content",
          label_singular: trimmedSingular,
          label_plural: trimmedPlural,
          description: description || "",
          icon: icon || "",
        });
      }

      const all = await api.get("/api/content-types");
      setTypes(all || []);

      setEditingType((prev) => ({
        ...prev,
        id: saved.id,
        slug: saved.slug,
        label_singular: saved.label_singular,
        label_plural: saved.label_plural,
        description: saved.description || "",
        icon: saved.icon || "",
        type: saved.type || "content",
      }));
      setSelectedTypeId(saved.id);
      setIsNewType(false);
      setSaveMessage("Content type saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save content type");
    } finally {
      setSavingType(false);
    }
  }

  // ==== FIELD HANDLERS ====
  function addFieldRow() {
    setFields((prev) => [
      ...prev,
      {
        id: null,
        field_key: "",
        label: "",
        type: "text",
        required: false,
        help_text: "",
        order_index: prev.length,
        config: {},
      },
    ]);
    setActiveFieldIndex(fields.length);
  }

  function updateFieldRow(index, patch) {
    setFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  }

  function removeFieldRow(index) {
    setFields((prev) => prev.filter((_, i) => i !== index));
    if (activeFieldIndex === index) setActiveFieldIndex(null);
  }

  async function saveFields(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    setSaveMessage("");

    if (!editingType.id) {
      setError("Save the content type first before saving fields.");
      return;
    }

    try {
      setSavingFields(true);

      const payloadFields = fields.map((f, index) => ({
        field_key: f.field_key,
        label: f.label,
        type: f.type || "text",
        required: !!f.required,
        help_text: f.help_text || "",
        order_index:
          typeof f.order_index === "number" ? f.order_index : index,
        config: f.config || {},
      }));

      await api.put(`/api/content-types/${editingType.id}/fields`, {
        fields: payloadFields,
      });

      setSaveMessage("Fields saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save fields");
    } finally {
      setSavingFields(false);
    }
  }

  const combinedSaving = savingType || savingFields;
  const hasSelectedType = isNewType || !!editingType.id;

  const contentTypes = types.filter((t) => !t.type || t.type === "content");
  const taxonomyTypes = types.filter((t) => t.type === "taxonomy");

  const renderTypeButton = (t) => {
    const isActive = !isNewType && t.id === selectedTypeId;
    const mainLabel = t.label_plural || t.label_singular || t.slug;
    const isTaxonomy = t.type === "taxonomy";

    return (
      <li key={t.id}>
        <button
          type="button"
          onClick={() => {
            setIsNewType(false);
            setSelectedTypeId(t.id);
            setSaveMessage("");
            setError("");
            setActiveFieldIndex(null);
          }}
          className={"qb-typeBtn " + (isActive ? "is-active" : "")}
        >
          <div className="qb-typeBtnInner">
            <div className="qb-typeBtnLabelRow">
              <span className="qb-typeBtnLabel">{mainLabel}</span>
              {isTaxonomy && <span className="qb-typeBtnMeta">Taxonomy</span>}
            </div>

            {t.slug && <div className="qb-typeBtnSlug">{t.slug}</div>}
          </div>
        </button>
      </li>
    );
  };

  const REPEATER_OPERATORS = [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "not contains" },
    { value: "gt", label: ">" },
    { value: "gte", label: ">=" },
    { value: "lt", label: "<" },
    { value: "lte", label: "<=" },
    { value: "truthy", label: "is filled (truthy)" },
    { value: "falsy", label: "is empty (falsy)" },
  ];

  function FieldConfigEditor({ field, onChange }) {
    if (!field) return null;

    const cfg =
      field.config && typeof field.config === "object"
        ? { ...field.config }
        : {};

    const type = field.type || "text";

    // --- Relationship inline-edit support (Option B) ---
    const isRelationType = ["relationship", "relation"].includes(type);

    // For our picker population, we treat `cfg.relatedType` as the slug.
    const relatedSlug = String(cfg.relatedType || "").trim();

    const relatedTypeObj = useMemo(() => {
      if (!relatedSlug) return null;
      return (
        (types || []).find((t) => String(t.slug || "") === relatedSlug) || null
      );
    }, [types, relatedSlug]);

    const [relatedFields, setRelatedFields] = useState([]);
    const [loadingRelatedFields, setLoadingRelatedFields] = useState(false);

    useEffect(() => {
      let cancelled = false;

      async function loadRelatedFields() {
        try {
          setLoadingRelatedFields(true);

          if (!relatedTypeObj?.id) {
            setRelatedFields([]);
            return;
          }

          const data = await api.get(`/api/content-types/${relatedTypeObj.id}`);
          if (cancelled) return;

          const list = (data?.fields || [])
            .map((f) => ({
              key: String(f.field_key || "").trim(),
              label: String(f.label || f.field_key || "").trim(),
              type: String(f.type || "").trim(),
            }))
            .filter((x) => x.key);

          setRelatedFields(list);
        } catch (e) {
          console.error(e);
          if (!cancelled) setRelatedFields([]);
        } finally {
          if (!cancelled) setLoadingRelatedFields(false);
        }
      }

      if (isRelationType && relatedSlug) loadRelatedFields();
      else setRelatedFields([]);

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRelationType, relatedTypeObj?.id, relatedSlug]);

    function updateCfg(patch) {
      onChange({ ...cfg, ...patch });
    }

    function updateInlineEdit(patch) {
      const current =
        cfg.inlineEdit && typeof cfg.inlineEdit === "object"
          ? { ...cfg.inlineEdit }
          : {};
      updateCfg({ inlineEdit: { ...current, ...patch } });
    }

    const inlineEdit =
      cfg.inlineEdit && typeof cfg.inlineEdit === "object" ? cfg.inlineEdit : {};

    // Choice helpers
    function choicesToText(c) {
      if (!Array.isArray(c)) return "";
      return c
        .map((item) => {
          if (typeof item === "string") return item;
          if (!item || !item.value) return "";
          if (!item.label || item.label === item.value) return item.value;
          return `${item.value}|${item.label}`;
        })
        .filter(Boolean)
        .join("\n");
    }

    function textToChoices(text) {
      const lines = String(text || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return lines
        .map((line) => {
          const [value, label] = line.split("|");
          const v = (value || "").trim();
          const l = (label || value || "").trim();
          if (!v) return null;
          return { value: v, label: l || v };
        })
        .filter(Boolean);
    }

    // ✅ Repeater subfield controls
    function updateRepeaterSubfield(i, patch) {
      const next = Array.isArray(cfg.subfields) ? [...cfg.subfields] : [];
      next[i] = { ...(next[i] || {}), ...patch };
      updateCfg({ subfields: next });
    }

    function removeRepeaterSubfield(i) {
      const next = (Array.isArray(cfg.subfields) ? [...cfg.subfields] : []).filter(
        (_, idx) => idx !== i
      );
      updateCfg({ subfields: next });
    }

    function addRepeaterSubfield() {
      const next = Array.isArray(cfg.subfields) ? [...cfg.subfields] : [];
      next.push({
        field_key: "",
        label: "",
        type: "text",
        required: false,
        help_text: "",
        config: {},
      });
      updateCfg({ subfields: next });
    }

    const maxDepth = Number.isFinite(cfg.maxDepth) ? Number(cfg.maxDepth) : 2;

    const repeaterLayout = cfg.layout || "cards"; // cards | table

    // Conditional rules (per row)
    function updateRule(i, patch) {
      const rules = Array.isArray(cfg.rules) ? [...cfg.rules] : [];
      rules[i] = { ...(rules[i] || {}), ...patch };
      updateCfg({ rules });
    }
    function addRule() {
      const rules = Array.isArray(cfg.rules) ? [...cfg.rules] : [];
      rules.push({
        ifKey: "",
        op: "equals",
        value: "",
        action: "show",
        targets: [],
      });
      updateCfg({ rules });
    }
    function removeRule(i) {
      const rules = (Array.isArray(cfg.rules) ? [...cfg.rules] : []).filter(
        (_, idx) => idx !== i
      );
      updateCfg({ rules });
    }

    const availableTargets = useMemo(() => {
      const subs = Array.isArray(cfg.subfields) ? cfg.subfields : [];
      return subs.map((s) => String(s?.field_key || "").trim()).filter(Boolean);
    }, [cfg.subfields]);

    const relatedFieldOptions = useMemo(() => {
      // We only want real field keys (not empty). We keep label handy for nicer display.
      return (relatedFields || []).map((f) => ({
        key: f.key,
        label: f.label || f.key,
        type: f.type || "",
      }));
    }, [relatedFields]);

    const inlineAllowedFields = Array.isArray(inlineEdit.fields)
      ? inlineEdit.fields
      : [];

    return (
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          Field config — {field.label || field.field_key || "(untitled)"}
        </div>

        {["radio", "dropdown", "checkbox", "select", "multiselect"].includes(
          type
        ) && (
          <div className="mb-4 space-y-1">
            <div className="font-medium">Choices</div>
            <p className="text-xs text-gray-500">
              One per line. Use <code>value|Label</code> if you want a separate
              label; otherwise label defaults to the value.
            </p>
            <textarea
              className="su-input"
              rows={4}
              value={choicesToText(cfg.choices)}
              onChange={(e) =>
                updateCfg({ choices: textToChoices(e.target.value) })
              }
            />
          </div>
        )}

        {type === "tags" && (
          <div className="mb-4 space-y-1">
            <div className="font-medium">Tag suggestions</div>
            <p className="text-xs text-gray-500">
              Comma-separated suggestions shown as you type.
            </p>
            <input
              className="su-input"
              value={(cfg.suggestions || []).join(", ")}
              onChange={(e) =>
                updateCfg({
                  suggestions: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="kpop, ballad, rock"
            />
          </div>
        )}

        {["relationship", "relation"].includes(type) && (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="font-medium">Related content type slug</span>
                <input
                  className="su-input"
                  value={cfg.relatedType || ""}
                  onChange={(e) => updateCfg({ relatedType: e.target.value })}
                  placeholder="intended-parents"
                />
                <div className="text-[11px] text-gray-500">
                  Must match the content type <code>slug</code>.
                </div>
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!cfg.multiple}
                    onChange={(e) => updateCfg({ multiple: e.target.checked })}
                  />
                  <span>Allow multiple related items</span>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!cfg.twoWay}
                    onChange={(e) => updateCfg({ twoWay: e.target.checked })}
                  />
                  <span>Two-way relation (sync inverse)</span>
                </label>
              </div>
              <label className="md:col-span-2 space-y-1">
                <span className="font-medium text-xs">
                  Inverse field key on related type
                </span>
                <input
                  className="su-input"
                  value={cfg.inverseKey || ""}
                  onChange={(e) => updateCfg({ inverseKey: e.target.value })}
                  placeholder="e.g. posts"
                />
              </label>
            </div>

            {/* ✅ OPTION B: Inline Edit UI for relationship fields */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Inline Edit (ServiceUp feature)
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-xs md:col-span-2">
                  <input
                    type="checkbox"
                    checked={!!inlineEdit.enabled}
                    onChange={(e) =>
                      updateInlineEdit({ enabled: e.target.checked })
                    }
                  />
                  <span>Enable inline edit for this relationship field</span>
                </label>

                <label className="space-y-1">
                  <span className="font-medium">Display mode</span>
                  <select
                    className="su-input"
                    value={inlineEdit.mode || "modal"}
                    onChange={(e) =>
                      updateInlineEdit({ mode: e.target.value })
                    }
                    disabled={!inlineEdit.enabled}
                  >
                    <option value="inline">
                      Inline (shown under relationship)
                    </option>
                    <option value="modal">Modal (button opens editor)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="font-medium">Modal title</span>
                  <input
                    className="su-input"
                    value={inlineEdit.title || ""}
                    onChange={(e) => updateInlineEdit({ title: e.target.value })}
                    placeholder="Edit Intended Parent Match Details"
                    disabled={!inlineEdit.enabled}
                  />
                </label>

                <label className="space-y-1">
                  <span className="font-medium">Show core fields</span>
                  <select
                    className="su-input"
                    value={
                      inlineEdit.showCore === undefined
                        ? "false"
                        : inlineEdit.showCore
                        ? "true"
                        : "false"
                    }
                    onChange={(e) =>
                      updateInlineEdit({ showCore: e.target.value === "true" })
                    }
                    disabled={!inlineEdit.enabled}
                  >
                    <option value="false">No (recommended)</option>
                    <option value="true">Yes</option>
                  </select>
                  <div className="text-[11px] text-gray-500">
                    “Core fields” = title/slug style fields (if present). Usually
                    you want this off.
                  </div>
                </label>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="font-medium">Allowed fields</div>
                      <div className="text-[11px] text-gray-500">
                        Choose which fields are editable in the inline editor.
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="su-btn su-btn-xs su-btn-ghost"
                        disabled={
                          !inlineEdit.enabled || !relatedFieldOptions.length
                        }
                        onClick={() =>
                          updateInlineEdit({
                            fields: relatedFieldOptions.map((x) => x.key),
                          })
                        }
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="su-btn su-btn-xs su-btn-ghost"
                        disabled={!inlineEdit.enabled}
                        onClick={() => updateInlineEdit({ fields: [] })}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {!relatedSlug ? (
                    <div className="mt-2 text-xs text-gray-500">
                      Enter a related content type slug above to load its fields.
                    </div>
                  ) : loadingRelatedFields ? (
                    <div className="mt-2 text-xs text-gray-500">
                      Loading fields for <code>{relatedSlug}</code>…
                    </div>
                  ) : !relatedTypeObj ? (
                    <div className="mt-2 text-xs text-red-600">
                      Could not find content type with slug{" "}
                      <code>{relatedSlug}</code>. (It must exist before we can
                      populate fields.)
                    </div>
                  ) : !relatedFieldOptions.length ? (
                    <div className="mt-2 text-xs text-gray-500">
                      No fields found on <code>{relatedSlug}</code> yet. Add
                      fields to that content type, then come back here.
                    </div>
                  ) : (
                    <select
                      className="su-input mt-2"
                      multiple
                      value={inlineAllowedFields}
                      disabled={!inlineEdit.enabled}
                      onChange={(e) => {
                        const vals = Array.from(e.target.selectedOptions).map(
                          (o) => o.value
                        );
                        updateInlineEdit({ fields: vals });
                      }}
                      style={{ minHeight: 140 }}
                    >
                      {relatedFieldOptions.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label} ({f.key}){f.type ? ` — ${f.type}` : ""}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="text-[11px] text-gray-500 mt-2">
                    Stored at <code>field.config.inlineEdit</code> so it can be
                    reused anywhere in ServiceUp.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {type === "relation_user" && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!cfg.multiple}
                  onChange={(e) => updateCfg({ multiple: e.target.checked })}
                />
                <span>Allow multiple users</span>
              </label>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={cfg.onlyActive === undefined ? true : !!cfg.onlyActive}
                  onChange={(e) => updateCfg({ onlyActive: e.target.checked })}
                />
                <span>Only show ACTIVE users in picker</span>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Role filter (optional)</span>
              <input
                className="su-input"
                value={cfg.roleFilter || ""}
                onChange={(e) =>
                  updateCfg({ roleFilter: e.target.value.toUpperCase() })
                }
                placeholder="ADMIN, EDITOR, etc."
              />
              <div className="text-[11px] text-gray-500">
                If set, picker will only show users with that role.
              </div>
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">Display format</span>
              <select
                className="su-input"
                value={cfg.display || "name_email"}
                onChange={(e) => updateCfg({ display: e.target.value })}
              >
                <option value="name_email">Name — Email</option>
                <option value="name">Name only</option>
                <option value="email">Email only</option>
              </select>
              <div className="text-[11px] text-gray-500">
                How the selected user should be labeled in editors and views.
              </div>
            </label>
          </div>
        )}

        {["image", "file", "video"].includes(type) && (
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
            <label className="space-y-1">
              <span className="font-medium">Accept MIME types</span>
              <input
                className="su-input"
                value={cfg.accept || ""}
                onChange={(e) => updateCfg({ accept: e.target.value })}
                placeholder="image/*,application/pdf"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium">Max file size (MB)</span>
              <input
                type="number"
                className="su-input"
                value={cfg.maxSizeMB ?? ""}
                onChange={(e) =>
                  updateCfg({
                    maxSizeMB: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
			<div className="md:col-span-2 grid gap-2">
				<label className="flex items-center gap-2 text-xs">
				<input
				type="checkbox"
				checked={cfg.dragDropDesktop !== false}
				onChange={(e) => updateCfg({ dragDropDesktop: e.target.checked })}
				/>
				<span>Enable drag & drop on desktop</span>
			</label>

			<label className="flex items-center gap-2 text-xs">
				<input
				type="checkbox"
				checked={!!cfg.multipleUploads}
				onChange={(e) => updateCfg({ multipleUploads: e.target.checked })}
				/>
				<span>Allow multiple uploads (disables title/caption/credit subfields)</span>
			</label>
			</div>

          </div>
        )}

        {type === "panels" && (
          <div className="mb-4 space-y-4">
            <div>
              <div className="font-medium">Panels and Page Templates</div>
              <p className="text-xs text-gray-500">
                Panels are typed website sections. Templates determine which Panels an entry may use and whether their order is flexible or fixed.
              </p>
            </div>
            <label className="space-y-1 block">
              <span className="font-medium text-xs">Add button label</span>
              <input className="su-input" value={cfg.addLabel || "Add Panel"} onChange={(e) => updateCfg({ addLabel: e.target.value })} />
            </label>
            <PanelsConfigBuilder config={cfg} onChange={onChange} />
          </div>
        )}

        {type === "repeater" && (
          <div className="mb-4 space-y-3">
            <div className="font-medium">Repeater settings</div>

            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1">
                <span className="font-medium text-xs">Min rows</span>
                <input
                  type="number"
                  className="su-input"
                  value={cfg.minRows ?? ""}
                  onChange={(e) =>
                    updateCfg({
                      minRows:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="font-medium text-xs">Max rows</span>
                <input
                  type="number"
                  className="su-input"
                  value={cfg.maxRows ?? ""}
                  onChange={(e) =>
                    updateCfg({
                      maxRows:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="font-medium text-xs">“Add row” label</span>
                <input
                  className="su-input"
                  value={cfg.addLabel ?? "Add row"}
                  onChange={(e) => updateCfg({ addLabel: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="font-medium text-xs">Layout</span>
                <select
                  className="su-input"
                  value={repeaterLayout}
                  onChange={(e) => updateCfg({ layout: e.target.value })}
                >
                  <option value="cards">Cards</option>
                  <option value="table">Table</option>
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="font-medium text-xs">Max nesting depth</span>
                <input
                  type="number"
                  className="su-input"
                  value={maxDepth}
                  min={1}
                  onChange={(e) =>
                    updateCfg({
                      maxDepth: Math.max(1, Number(e.target.value || 1)),
                    })
                  }
                />
                <div className="text-[11px] text-gray-500">
                  1 = no nested repeaters. 2 = allow one repeater inside another,
                  etc.
                </div>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="font-medium text-xs">
                  Row label template (optional)
                </span>
                <input
                  className="su-input"
                  value={cfg.rowLabelTemplate ?? ""}
                  onChange={(e) => updateCfg({ rowLabelTemplate: e.target.value })}
                  placeholder='Example: "Item {#}: {name}"'
                />
                <div className="text-[11px] text-gray-500">
                  Supports <code>{"{#}"}</code> and <code>{"{field_key}"}</code>.
                </div>
              </label>
            </div>

            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Subfields
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 pr-2">Key</th>
                      <th className="py-2 pr-2">Label</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Required</th>
                      <th className="py-2 pr-2">Help text</th>
                      <th className="py-2 pr-2">Config (JSON)</th>
                      <th className="py-2 pr-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(cfg.subfields) ? cfg.subfields : []).map(
                      (sf, i) => {
                        const configText =
                          typeof sf?.config === "object"
                            ? JSON.stringify(sf.config, null, 2)
                            : sf?.configText || "";

                        const typeOptions = FIELD_TYPES.filter((t) => {
                          if (t.value !== "repeater") return true;
                          return true;
                        });

                        return (
                          <tr key={i} className="border-b border-gray-100 align-top">
                            <td className="py-1 pr-2">
                              <input
                                className="su-input su-input-sm"
                                value={sf.field_key || ""}
                                onChange={(e) =>
                                  updateRepeaterSubfield(i, {
                                    field_key: e.target.value,
                                  })
                                }
                                placeholder="subfield_key"
                              />
                            </td>

                            <td className="py-1 pr-2">
                              <input
                                className="su-input su-input-sm"
                                value={sf.label || ""}
                                onChange={(e) =>
                                  updateRepeaterSubfield(i, {
                                    label: e.target.value,
                                  })
                                }
                                placeholder="Subfield label"
                              />
                            </td>

                            <td className="py-1 pr-2">
                              <select
                                className="su-input su-input-sm min-w-[180px]"
                                value={sf.type || "text"}
                                onChange={(e) =>
                                  updateRepeaterSubfield(i, {
                                    type: e.target.value,
                                  })
                                }
                              >
                                {typeOptions.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                              {sf.type === "repeater" && (
                                <div className="text-[11px] text-gray-500 mt-1">
                                  Nested repeater allowed up to depth {maxDepth}.
                                </div>
                              )}
                            </td>

                            <td className="py-1 pr-2">
                              <input
                                type="checkbox"
                                checked={!!sf.required}
                                onChange={(e) =>
                                  updateRepeaterSubfield(i, {
                                    required: e.target.checked,
                                  })
                                }
                              />
                            </td>

                            <td className="py-1 pr-2">
                              <input
                                className="su-input su-input-sm"
                                value={sf.help_text || ""}
                                onChange={(e) =>
                                  updateRepeaterSubfield(i, {
                                    help_text: e.target.value,
                                  })
                                }
                                placeholder="Shown under this subfield"
                              />
                            </td>

                            <td className="py-1 pr-2" style={{ minWidth: 260 }}>
                              <textarea
                                className="su-input su-input-sm"
                                rows={4}
                                value={configText}
                                onChange={(e) => {
                                  const parsed = safeJsonParse(e.target.value);
                                  if (parsed.ok) {
                                    updateRepeaterSubfield(i, {
                                      config: parsed.value,
                                      configText: undefined,
                                    });
                                  } else {
                                    updateRepeaterSubfield(i, {
                                      configText: e.target.value,
                                    });
                                  }
                                }}
                                placeholder='{"accept":"image/*"}'
                              />
                              <div className="text-[11px] text-gray-500 mt-1">
                                Leave blank for none. (Must be valid JSON to save.)
                              </div>
                            </td>

                            <td className="py-1 pr-0 text-right">
                              <button
                                type="button"
                                className="su-btn su-btn-xs su-btn-danger"
                                onClick={() => removeRepeaterSubfield(i)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="su-btn su-btn-sm su-btn-ghost mt-2"
                onClick={addRepeaterSubfield}
              >
                + Add subfield
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Conditional rules (per row)
              </div>

              <div className="text-[11px] text-gray-500 mb-2">
                Each rule reads a value in the row and then shows/hides selected
                subfields. Rules are evaluated top-to-bottom; later rules can
                override earlier ones.
              </div>

              {(Array.isArray(cfg.rules) ? cfg.rules : []).map((r, i) => (
                <div
                  key={i}
                  className="grid gap-2 md:grid-cols-[1.2fr,1fr,1.2fr,1fr,1.6fr,auto] items-end mb-2"
                >
                  <label className="space-y-1">
                    <span className="text-xs font-medium">If field</span>
                    <input
                      className="su-input"
                      value={r.ifKey || ""}
                      onChange={(e) => updateRule(i, { ifKey: e.target.value })}
                      placeholder="field_key"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium">Operator</span>
                    <select
                      className="su-input"
                      value={r.op || "equals"}
                      onChange={(e) => updateRule(i, { op: e.target.value })}
                    >
                      {REPEATER_OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium">Value</span>
                    <input
                      className="su-input"
                      value={r.value ?? ""}
                      onChange={(e) => updateRule(i, { value: e.target.value })}
                      placeholder="(optional)"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium">Action</span>
                    <select
                      className="su-input"
                      value={r.action || "show"}
                      onChange={(e) => updateRule(i, { action: e.target.value })}
                    >
                      <option value="show">Show targets</option>
                      <option value="hide">Hide targets</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs font-medium">Targets</span>
                    <select
                      className="su-input"
                      multiple
                      value={Array.isArray(r.targets) ? r.targets : []}
                      onChange={(e) => {
                        const vals = Array.from(e.target.selectedOptions).map(
                          (o) => o.value
                        );
                        updateRule(i, { targets: vals });
                      }}
                      style={{ minHeight: 46 }}
                    >
                      {availableTargets.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="su-btn su-btn-sm su-btn-danger"
                    onClick={() => removeRule(i)}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="su-btn su-btn-sm su-btn-ghost"
                onClick={addRule}
              >
                + Add rule
              </button>
            </div>
          </div>
        )}

        {supportsSubfields(type) && (
          <SubfieldControls
            type={type}
            config={cfg}
            onChange={(subCfg) => onChange(subCfg)}
          />
        )}

        {(type === "date" || type === "datetime" || type === "time") && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {type !== "time" && (
              <label className="space-y-1">
                <span className="font-medium">Date style</span>
                <select
                  className="su-input"
                  value={cfg.dateStyle || "long"}
                  onChange={(e) => updateCfg({ dateStyle: e.target.value })}
                >
                  <option value="long">Long (December 22, 2025)</option>
                  <option value="medium">Medium</option>
                  <option value="short">Short</option>
                </select>
                <div className="text-[11px] text-gray-500">
                  Used for display in editors + lists/widgets.
                </div>
              </label>
            )}

            {type === "datetime" && (
              <label className="space-y-1">
                <span className="font-medium">Default timezone</span>
                <input
                  className="su-input"
                  value={cfg.defaultTZ || "America/Los_Angeles"}
                  onChange={(e) => updateCfg({ defaultTZ: e.target.value })}
                  placeholder="America/Los_Angeles"
                />
                <div className="text-[11px] text-gray-500">
                  Used when converting selected date+time into UTC.
                </div>
              </label>
            )}

            <label className="space-y-1 md:col-span-2">
              <span className="font-medium">Locale</span>
              <input
                className="su-input"
                value={cfg.locale || "en-US"}
                onChange={(e) => updateCfg({ locale: e.target.value })}
                placeholder="en-US"
              />
            </label>

            {type === "time" && (
              <div className="text-[11px] text-gray-500 md:col-span-2">
                Time display defaults to <code>6:50pm</code> style (lowercase
                am/pm).
              </div>
            )}
          </div>
        )}

        {![
          "radio",
          "dropdown",
          "checkbox",
          "tags",
          "relationship",
          "relation",
          "relation_user",
          "image",
          "file",
          "video",
          "name",
          "address",
          "repeater",
          "panels",
          "date",
          "datetime",
          "time",
        ].includes(type) &&
          !supportsSubfields(type) && (
            <div className="text-xs text-gray-500">
              This field type has no extra config yet. (We can always add more
              later.)
            </div>
          )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">QuickBuilder 2.0</h1>
        <p className="text-sm text-gray-600">
          Define your content types and their fields. These definitions power
          entry lists, editors, and relationships throughout ServiceUp.
        </p>
      </div>

      {error && (
        <div
          className="su-card"
          style={{ borderColor: "#fecaca", background: "#fef2f2" }}
        >
          <div style={{ color: "#991b1b", fontSize: 13 }}>{error}</div>
        </div>
      )}

      {saveMessage && (
        <div
          className="su-card"
          style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}
        >
          <div style={{ color: "#166534", fontSize: 13 }}>{saveMessage}</div>
        </div>
      )}

      {/* ✅ NEW LAYOUT:
          Desktop: 2 columns (Types | Details)
          Underneath: Fields full width
          Mobile: stacks naturally using your su-grid rules */}
      <div className="su-grid cols-2 gap-6">
        {/* LEFT: type list */}
        <div className="su-card self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-base font-medium">Content Types</h2>
            <button
              type="button"
              className="su-btn su-btn-sm"
              onClick={startNewType}
            >
              + New type
            </button>
          </div>

          {loadingTypes ? (
            <div style={{ fontSize: 13 }}>Loading types...</div>
          ) : !types.length ? (
            <div style={{ fontSize: 13 }}>
              No content types yet. Create your first one with{" "}
              <strong>New type</strong>.
            </div>
          ) : (
            <>
              {contentTypes.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {contentTypes.map(renderTypeButton)}
                </ul>
              )}

              {taxonomyTypes.length > 0 && (
                <>
                  <div className="mt-4 mb-1 text-[11px] uppercase tracking-wide text-gray-500">
                    Taxonomies
                  </div>
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    {taxonomyTypes.map(renderTypeButton)}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        {/* RIGHT: details only */}
        <div className="su-card self-start">
          <form onSubmit={saveType} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="m-0 text-base font-medium">
                {isNewType ? "New Content Type" : "Content Type Details"}
              </h2>
              <button
                type="submit"
                className="su-btn su-btn-sm"
                disabled={savingType}
              >
                {savingType ? "Saving..." : "Save type"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Slug</span>
                <input
                  type="text"
                  className="su-input"
                  value={editingType.slug}
                  onChange={(e) =>
                    handleTypeChange("slug", e.target.value.toLowerCase())
                  }
                  placeholder="content-type"
                />
                <div className="text-[11px] text-gray-500">
                  Internal ID, usually lower_snake_case. Cannot be duplicated.
                </div>
              </label>

              <label className="space-y-1 text-sm">
                <span>Type</span>
                <select
                  className="su-input"
                  value={editingType.type}
                  onChange={(e) => handleTypeChange("type", e.target.value)}
                >
                  <option value="content">Content</option>
                  <option value="taxonomy">Taxonomy</option>
                </select>
                <div className="text-[11px] text-gray-500">
                  Use <strong>Taxonomy</strong> for categories, tags, etc.
                </div>
              </label>

              <label className="space-y-1 text-sm">
                <span>Singular label</span>
                <input
                  type="text"
                  className="su-input"
                  value={editingType.label_singular}
                  onChange={(e) =>
                    handleTypeChange("label_singular", e.target.value)
                  }
                  placeholder="Movie"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span>Plural label</span>
                <input
                  type="text"
                  className="su-input"
                  value={editingType.label_plural}
                  onChange={(e) =>
                    handleTypeChange("label_plural", e.target.value)
                  }
                  placeholder="Movies"
                />
              </label>

              <label className="text-sm md:col-span-2 space-y-1">
                <span>Description</span>
                <textarea
                  className="su-input"
                  rows={2}
                  value={editingType.description}
                  onChange={(e) =>
                    handleTypeChange("description", e.target.value)
                  }
                  placeholder="Short description of this content type."
                />
              </label>
            </div>
          </form>
        </div>

        {/* FULL WIDTH: fields */}
        <div className="su-card col-span-2 space-y-6">
          <form onSubmit={saveFields} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="m-0 text-base font-medium">Fields</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="su-btn su-btn-sm su-btn-ghost"
                  onClick={addFieldRow}
                  disabled={!hasSelectedType}
                >
                  + Add field
                </button>
                <button
                  type="submit"
                  className="su-btn su-btn-sm"
                  disabled={!hasSelectedType || savingFields}
                >
                  {savingFields ? "Saving..." : "Save fields"}
                </button>
              </div>
            </div>

            {!hasSelectedType ? (
              <div className="text-sm text-gray-600">
                Create and save a content type first, then you can define its
                fields.
              </div>
            ) : loadingFields && !isNewType ? (
              <div className="text-sm text-gray-600">Loading fields...</div>
            ) : !fields.length ? (
              <div className="text-sm text-gray-600">
                No fields yet. Click <strong>Add field</strong> to define your
                first field.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-2">Key</th>
                        <th className="py-2 pr-2">Label</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2">Required</th>
                        <th className="py-2 pr-2">Order</th>
                        <th className="py-2 pr-2">Help text</th>
                        <th className="py-2 pr-2 text-right">Config</th>
                        <th className="py-2 pr-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-100 align-top"
                        >
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              className="su-input su-input-sm"
                              value={field.field_key}
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  field_key: e.target.value,
                                })
                              }
                              placeholder="field_key"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              className="su-input su-input-sm"
                              value={field.label}
                              onChange={(e) =>
                                updateFieldRow(index, { label: e.target.value })
                              }
                              placeholder="Field label"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <select
                              className="su-input su-input-sm min-w-[180px]"
                              value={field.type}
                              onChange={(e) => {
                                updateFieldRow(index, {
                                  type: e.target.value,
                                });
                              }}
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  required: e.target.checked,
                                })
                              }
                            />
                          </td>
                          <td className="py-1 pr-2" style={{ width: 70 }}>
                            <input
                              type="number"
                              className="su-input su-input-sm"
                              value={
                                typeof field.order_index === "number"
                                  ? field.order_index
                                  : index
                              }
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  order_index: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              className="su-input su-input-sm"
                              value={field.help_text}
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  help_text: e.target.value,
                                })
                              }
                              placeholder="Shown under the field in editors"
                            />
                          </td>
                          <td className="py-1 pr-2 text-right">
                            <button
                              type="button"
                              className={
                                "su-btn su-btn-xs " +
                                (activeFieldIndex === index
                                  ? "su-btn-primary"
                                  : "su-btn-ghost")
                              }
                              onClick={() =>
                                setActiveFieldIndex((prev) =>
                                  prev === index ? null : index
                                )
                              }
                            >
                              {activeFieldIndex === index
                                ? "Hide config"
                                : "Edit config"}
                            </button>
                          </td>
                          <td className="py-1 pr-0 text-right">
                            <button
                              type="button"
                              className="su-btn su-btn-xs su-btn-danger"
                              onClick={() => removeFieldRow(index)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {activeFieldIndex !== null && fields[activeFieldIndex] && (
                  <FieldConfigEditor
                    field={fields[activeFieldIndex]}
                    onChange={(cfg) =>
                      updateFieldRow(activeFieldIndex, { config: cfg })
                    }
                  />
                )}
              </>
            )}
          </form>

          {combinedSaving && (
            <div className="text-[11px] text-gray-500">
              Saving… please don&apos;t close this tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
