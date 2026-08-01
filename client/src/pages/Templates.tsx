import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { templateApi, Template } from '../services/api';
import { COLUMN_ICONS, COLUMN_ICON_OPTIONS } from '../components/icons';

interface TemplateColumnFormState {
  name: string;
  color: string | null;
  icon: string | null;
}

interface TemplateFormState {
  name: string;
  columns: TemplateColumnFormState[];
}

const emptyColumn: TemplateColumnFormState = { name: '', color: null, icon: null };
const emptyForm: TemplateFormState = { name: '', columns: [{ ...emptyColumn }] };

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<TemplateFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setError(null);
      const data = await templateApi.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setForm(emptyForm);
    setEditingId('new');
  };

  const startEdit = (template: Template) => {
    setForm({
      name: template.name,
      columns: template.columns.map((c) => ({ name: c.name, color: c.color, icon: c.icon })),
    });
    setEditingId(template.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleColumnChange = <K extends keyof TemplateColumnFormState>(
    index: number,
    field: K,
    value: TemplateColumnFormState[K],
  ) => {
    setForm((f) => ({
      ...f,
      columns: f.columns.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  };

  const addColumnRow = () => {
    setForm((f) => ({ ...f, columns: [...f.columns, { ...emptyColumn }] }));
  };

  const removeColumnRow = (index: number) => {
    setForm((f) => ({ ...f, columns: f.columns.filter((_, i) => i !== index) }));
  };

  const moveColumnRow = (index: number, direction: -1 | 1) => {
    setForm((f) => {
      const target = index + direction;
      if (target < 0 || target >= f.columns.length) return f;
      const columns = [...f.columns];
      [columns[index], columns[target]] = [columns[target], columns[index]];
      return { ...f, columns };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = { name: form.name, columns: form.columns };
      if (editingId === 'new') {
        await templateApi.createTemplate(payload);
      } else if (typeof editingId === 'number') {
        await templateApi.updateTemplate(editingId, payload);
      }
      cancelEdit();
      await load();
    } catch (err) {
      console.error('Failed to save template:', err);
      setError('Failed to save template. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (templateId: number) => {
    if (!window.confirm('Delete this template? Boards already created from it keep their columns.')) return;
    try {
      await templateApi.deleteTemplate(templateId);
      await load();
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError('Failed to delete template. Please try again.');
    }
  };

  if (loading) {
    return <div className="p-5">Loading...</div>;
  }

  return (
    <div className="p-5">
      <Link to="/" className="text-blue-600 no-underline hover:underline text-sm">← Back to boards</Link>
      <h2 className="text-2xl font-bold my-4">Board Templates</h2>
      {error && (
        <div className="p-2.5 mb-4 bg-red-100 text-red-800 border border-red-200 rounded">{error}</div>
      )}

      <ul className="list-none p-0 mb-5">
        {templates.map((template) => (
          <li
            key={template.id}
            className="p-2.5 my-2.5 border border-gray-300 rounded bg-gray-50 flex justify-between items-center"
          >
            <div>
              <strong>{template.name}</strong>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-600">
                {template.columns.map((c) => {
                  const Icon = c.icon ? COLUMN_ICONS[c.icon] : null;
                  return (
                    <span key={c.id} className="inline-flex items-center gap-1">
                      {c.color && (
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                      )}
                      {Icon && <Icon size={14} style={{ color: c.color ?? undefined }} />}
                      {c.name}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(template)}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white border-none rounded cursor-pointer text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white border-none rounded cursor-pointer text-sm"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editingId === null ? (
        <button
          onClick={startCreate}
          className="px-5 py-2.5 text-base text-white border-none rounded cursor-pointer bg-blue-600 hover:bg-blue-700"
        >
          + New Template
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="border border-gray-300 rounded p-4 bg-gray-50 flex flex-col gap-2.5 max-w-md">
          <h3 className="text-lg font-bold m-0">{editingId === 'new' ? 'New Template' : 'Edit Template'}</h3>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Template name"
            className="p-2 text-base border border-gray-300 rounded"
          />
          {form.columns.map((col, index) => (
            <div key={index} className="flex gap-1.5 items-center">
              <input
                type="color"
                value={col.color ?? '#e5e7eb'}
                onChange={(e) => handleColumnChange(index, 'color', e.target.value)}
                title="Column color"
                className="w-7 h-7 p-0 border border-gray-300 rounded cursor-pointer shrink-0"
              />
              <select
                value={col.icon ?? ''}
                onChange={(e) => handleColumnChange(index, 'icon', e.target.value || null)}
                title="Column icon"
                className="p-1.5 text-sm border border-gray-300 rounded shrink-0"
              >
                <option value="">No icon</option>
                {COLUMN_ICON_OPTIONS.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <input
                type="text"
                value={col.name}
                onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                placeholder={`Column ${index + 1} name`}
                className="flex-1 p-1.5 text-sm border border-gray-300 rounded"
              />
              <button type="button" onClick={() => moveColumnRow(index, -1)} disabled={index === 0} className="px-1.5 text-sm disabled:opacity-30">↑</button>
              <button type="button" onClick={() => moveColumnRow(index, 1)} disabled={index === form.columns.length - 1} className="px-1.5 text-sm disabled:opacity-30">↓</button>
              <button type="button" onClick={() => removeColumnRow(index)} disabled={form.columns.length === 1} className="px-1.5 text-sm text-red-600 disabled:opacity-30">✕</button>
            </div>
          ))}
          <button
            type="button"
            onClick={addColumnRow}
            className="p-1.5 bg-transparent border border-dashed border-gray-400 rounded cursor-pointer text-gray-600 text-sm hover:bg-gray-100"
          >
            + Add column
          </button>
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={submitting || !form.name.trim() || !form.columns.some((c) => c.name.trim())}
              className="flex-1 p-2 text-white border-none rounded cursor-pointer bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex-1 p-2 bg-transparent border border-gray-300 rounded cursor-pointer hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
