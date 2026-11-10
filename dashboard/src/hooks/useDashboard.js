// admin/src/hooks/useDashboard.js
import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Fallback starter layout if API returns nothing
const DEFAULT_LAYOUT = [
  {
    id: "welcome",
    type: "html-block",
    title: "Welcome to ServiceUp",
    config: {
      html: "<p>Use the dashboard builder to add widgets for your team.</p>",
    },
    roles: ["ADMIN", "EDITOR"],
  },
];

export function useDashboard() {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      // API returns either an array or an object with .layout
      const resp = await api.get("/api/dashboard");
      let layout = [];

      if (Array.isArray(resp)) {
        layout = resp;
      } else if (resp && Array.isArray(resp.layout)) {
        layout = resp.layout;
      }

      if (!layout || !layout.length) {
        layout = DEFAULT_LAYOUT;
      }

      setWidgets(layout);
    } catch (e) {
      console.error("[useDashboard] Failed to load dashboard", e);
      setError(e?.message || "Failed to load dashboard layout");
      setWidgets(DEFAULT_LAYOUT);
    } finally {
      setLoading(false);
    }
  }

  async function persist(nextLayout, previousLayout) {
    setSaving(true);
    setError("");
    try {
      await api.post("/api/dashboard", { layout: nextLayout });
    } catch (e) {
      console.error("[useDashboard] Failed to save layout", e);
      setError(e?.message || "Failed to save dashboard layout");
      setWidgets(previousLayout);
    } finally {
      setSaving(false);
    }
  }

  function addWidget(definition) {
    const previous = widgets;
    const id = definition.id || `${definition.type}-${Date.now()}`;
    const next = [...widgets, { ...definition, id }];
    setWidgets(next);
    void persist(next, previous);
  }

  function updateWidget(id, patch) {
    const previous = widgets;
    const next = widgets.map((w) =>
      w.id === id ? { ...w, ...patch, config: { ...w.config, ...patch.config } } : w
    );
    setWidgets(next);
    void persist(next, previous);
  }

  function removeWidget(id) {
    const previous = widgets;
    const next = widgets.filter((w) => w.id !== id);
    setWidgets(next);
    void persist(next, previous);
  }

  useEffect(() => {
    load();
  }, []);

  return {
    widgets,
    loading,
    saving,
    error,
    reload: load,
    addWidget,
    updateWidget,
    removeWidget,
  };
}
