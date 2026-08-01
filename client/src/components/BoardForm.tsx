import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { templateApi, Template } from '../services/api';

interface BoardFormProps {
  onSubmit: (name: string, templateId: number) => void;
  loading: boolean;
}

export default function BoardForm({ onSubmit, loading }: BoardFormProps) {
  const [boardName, setBoardName] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    templateApi
      .getTemplates()
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) setSelectedTemplateId(data[0].id);
      })
      .catch((err) => {
        console.error('Failed to load templates:', err);
        setError('Failed to load templates.');
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (boardName.trim() && selectedTemplateId !== null) {
      onSubmit(boardName, selectedTemplateId);
      setBoardName('');
    }
  };

  return (
    <div className="p-5 border-b border-gray-300">
      <h2 className="text-2xl font-bold mb-4">Create New Board</h2>
      {error && (
        <div className="text-red-800 bg-red-100 border border-red-200 p-2 rounded mb-3">{error}</div>
      )}
      {!loadingTemplates && templates.length === 0 && !error && (
        <div className="p-2.5 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded text-sm mb-3">
          No templates yet.{' '}
          <Link to="/templates" className="text-blue-600 underline">Create one</Link>{' '}
          to start a board.
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          type="text"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          placeholder="Enter board name"
          disabled={loading}
          className="p-2.5 text-base border border-gray-300 rounded"
        />
        <div className="flex flex-wrap gap-2.5">
          {templates.map((template) => (
            <label
              key={template.id}
              className={`flex-1 min-w-[200px] p-2.5 border rounded cursor-pointer ${
                selectedTemplateId === template.id ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="template"
                value={template.id}
                checked={selectedTemplateId === template.id}
                onChange={() => setSelectedTemplateId(template.id)}
                className="mr-2"
              />
              <strong>{template.name}</strong>
              <div className="text-sm text-gray-600">
                {template.columns.map((c) => c.name).join(', ')}
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="submit"
            disabled={loading || !boardName.trim() || selectedTemplateId === null}
            className={`px-5 py-2.5 text-base text-white border-none rounded cursor-pointer ${
              loading || !boardName.trim() || selectedTemplateId === null
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Creating...' : 'Create Board'}
          </button>
          <Link to="/templates" className="text-blue-600 no-underline hover:underline text-sm">
            Manage templates
          </Link>
        </div>
      </form>
    </div>
  );
}
