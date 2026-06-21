import React, { useState, useEffect } from 'react';
import { User, Cpu, Network, RefreshCw, Plus, Trash2, Settings as SettingsIcon, Info, ChevronDown, ChevronRight } from 'lucide-react';

const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
  <button 
    type="button"
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${checked ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
    onClick={() => onChange(!checked)}
  >
    <span className="sr-only">Toggle</span>
    <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-2' : '-translate-x-2'}`} />
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-10">
    <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100 mb-4 px-1">{title}</h3>
    <div className="flex flex-col gap-0">
      {children}
    </div>
  </div>
);

const SettingRow = ({ label, description, children, border = true }: { label: React.ReactNode, description?: React.ReactNode, children: React.ReactNode, border?: boolean }) => (
  <div className={`flex items-center justify-between py-4 px-1 ${border ? 'border-b border-gray-100 dark:border-[#2b2b2b]' : ''}`}>
    <div className="flex flex-col gap-0.5 pr-4 max-w-[65%]">
      <span className="text-[14px] text-gray-800 dark:text-gray-200">{label}</span>
      {description && <span className="text-xs text-gray-500 dark:text-[#888888]">{description}</span>}
    </div>
    <div className="flex-shrink-0 flex items-center justify-end w-64">
      {children}
    </div>
  </div>
);

const SettingInput = ({ value, onChange, placeholder, type = "text", className = "" }: any) => (
  <input 
    type={type} 
    value={value} 
    onChange={onChange} 
    placeholder={placeholder}
    className={`w-full px-3 py-2 text-[14px] bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-gray-100 transition-colors shadow-sm ${className}`}
  />
);

const SettingSelect = ({ value, onChange, children, className = "" }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>, 'option'> =>
      React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(child) && child.type === 'option',
  );
  const selectedOption = options.find(opt => opt.props.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-[14px] bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-gray-100 transition-colors shadow-sm text-left"
      >
        <span className="truncate">{selectedOption?.props.children}</span>
        <ChevronDown size={14} className={`opacity-50 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-[#2b2b2b] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-auto py-1 animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange({ target: { value: opt.props.value } });
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                opt.props.value === value 
                  ? 'bg-blue-50/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#383838]'
              }`}
            >
              {opt.props.children}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface SettingsModalProps {
  port: number;
  onClose: () => void;
  onRestart?: () => void;
}

const buildExtraParamsTextMap = (models: any[] = []) =>
  Object.fromEntries(
    models.map((model, index) => [
      index,
      JSON.stringify(model?.extra_params ?? {}, null, 2),
    ]),
  );

const normalizeModels = (models: any[] = []) =>
  models.map((model) => ({
    model_id: model?.model_id ?? '',
    api_provider: model?.api_provider ?? '',
    max_context: model?.max_context ?? '',
    price_in: model?.price_in ?? '',
    price_out: model?.price_out ?? '',
    cache_hit_price_in: model?.cache_hit_price_in ?? '',
    force_stream_mode: model?.force_stream_mode === true,
    tool_call_compat: model?.tool_call_compat === true,
    anti_truncation: model?.anti_truncation === true,
    extra_params: model?.extra_params ?? {},
  }));

const parseMaxContextValue = (value: unknown) => {
  if (typeof value === 'string' && value.toLowerCase().endsWith('k')) {
    const num = parseFloat(value.slice(0, -1));
    return Number.isNaN(num) ? undefined : num * 1024;
  }
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return Number.isNaN(num) ? undefined : num;
  }
  return typeof value === 'number' ? value : undefined;
};

const parseNumberValue = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const parseNullableNumberValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' && !value.trim()) {
    return null;
  }
  const parsed = parseNumberValue(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
};

const SettingsModal: React.FC<SettingsModalProps> = ({ port, onClose, onRestart }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [config, setConfig] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState<Record<string, string> | null>(null);
  const [expandedModel, setExpandedModel] = useState<number | null>(null);
  const [modelExtraParamsText, setModelExtraParamsText] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch(`http://127.0.0.1:${port}/api/version`)
      .then(res => res.json())
      .then(data => setVersion(data))
      .catch(() => {});
  }, [port]);

  useEffect(() => {
    fetch(`http://127.0.0.1:${port}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'error') {
          setError(data.message);
        } else {
          const normalized = {
            ...data,
            models: normalizeModels(data.models || []),
          };
          setConfig(normalized);
          setModelExtraParamsText(buildExtraParamsTextMap(normalized.models));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load settings:", err);
        setError("加载设置失败，请检查后端是否正常运行。");
        setLoading(false);
      });
  }, [port]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError('');
    try {
      const parsedConfig = JSON.parse(JSON.stringify(config));
      if (parsedConfig.models) {
        parsedConfig.models = parsedConfig.models.map((m: any, index: number) => {
          const rawExtraParams =
            modelExtraParamsText[index] ??
            JSON.stringify(m.extra_params ?? {}, null, 2);
          let extraParams = {};
          if (rawExtraParams.trim()) {
            try {
              extraParams = JSON.parse(rawExtraParams);
            } catch {
              throw new Error(
                `模型 ${m.model_id || `#${index + 1}`} 的 Extra Params 不是有效 JSON`,
              );
            }
          }
          return {
            ...m,
            max_context: parseMaxContextValue(m.max_context),
            price_in: parseNumberValue(m.price_in, 0),
            price_out: parseNumberValue(m.price_out, 0),
            cache_hit_price_in: parseNullableNumberValue(m.cache_hit_price_in),
            force_stream_mode: m.force_stream_mode === true,
            tool_call_compat: m.tool_call_compat === true,
            anti_truncation: m.anti_truncation === true,
            extra_params: extraParams,
          };
        });
      }

      const res = await fetch(`http://127.0.0.1:${port}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedConfig)
      });
      const data = await res.json();
      if (data.status === 'error') {
        setError(data.message);
      } else {
        setSaveSuccess(true);
        setTimeout(() => {
          if (onRestart) {
            onRestart();
          } else {
            onClose();
          }
        }, 1500);
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setError(err?.message || "保存设置失败！");
    } finally {
      setSaving(false);
    }
  };

  const updateNestedConfig = (path: string[], value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      let current = newConfig;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  const updateProvider = (index: number, field: string, value: string) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      const oldName = newConfig.api_providers[index][field];
      newConfig.api_providers[index][field] = value;

      // 当供应商名称变更时，同步更新 models.api_provider、roles 和 model_profiles 中的引用
      if (field === 'name' && oldName !== value) {
        const prefix = `${oldName}/`;
        // 更新 models 中的 api_provider 引用
        if (newConfig.models) {
          newConfig.models = newConfig.models.map((m: any) =>
            m.api_provider === oldName ? { ...m, api_provider: value } : m
          );
        }
        // 更新 roles 中的 "OldName/modelId" → "NewName/modelId"
        if (newConfig.roles) {
          const newRoles: Record<string, string> = {};
          for (const [role, modelName] of Object.entries(newConfig.roles as Record<string, string>)) {
            if (typeof modelName === 'string' && modelName.startsWith(prefix)) {
              newRoles[role] = `${value}/${modelName.slice(prefix.length)}`;
            } else {
              newRoles[role] = modelName;
            }
          }
          newConfig.roles = newRoles;
        }
        // 更新 model_profiles 中的 model_name
        if (newConfig.model_profiles) {
          newConfig.model_profiles = newConfig.model_profiles.map((mp: any) => {
            if (typeof mp.model_name === 'string' && mp.model_name.startsWith(prefix)) {
              return { ...mp, model_name: `${value}/${mp.model_name.slice(prefix.length)}` };
            }
            return mp;
          });
        }
      }

      return newConfig;
    });
  };

  const updateModel = (index: number, field: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      const oldModel = { ...newConfig.models[index] };
      newConfig.models[index] = { ...oldModel, [field]: value };

      // 当 model_id 或 api_provider 变更时，同步更新 roles 和 model_profiles 中的引用
      if (field === 'model_id' || field === 'api_provider') {
        const oldName = `${oldModel.api_provider}/${oldModel.model_id}`;
        const newName = `${newConfig.models[index].api_provider}/${newConfig.models[index].model_id}`;
        if (oldName !== newName && oldModel.model_id && oldModel.api_provider) {
          // 更新 roles
          if (newConfig.roles) {
            const newRoles: Record<string, string> = {};
            for (const [role, modelName] of Object.entries(newConfig.roles as Record<string, string>)) {
              newRoles[role] = modelName === oldName ? newName : modelName;
            }
            newConfig.roles = newRoles;
          }
          // 更新 model_profiles
          if (newConfig.model_profiles) {
            newConfig.model_profiles = newConfig.model_profiles.map((mp: any) =>
              mp.model_name === oldName ? { ...mp, model_name: newName } : mp
            );
          }
        }
      }

      return newConfig;
    });
  };

  const addModel = () => {
    const defaultProvider = config?.api_providers?.[0]?.name || '';
    const nextModels = [
      ...(config?.models || []),
      {
        model_id: 'new-model',
        api_provider: defaultProvider,
        max_context: '',
        price_in: '',
        price_out: '',
        cache_hit_price_in: '',
        force_stream_mode: false,
        tool_call_compat: false,
        anti_truncation: false,
        extra_params: {},
      },
    ];
    setConfig((prev: any) => ({ ...prev, models: nextModels }));
    setModelExtraParamsText(buildExtraParamsTextMap(nextModels));
  };

  const removeModel = (index: number) => {
    const nextModels = (config?.models || []).filter((_: any, modelIndex: number) => modelIndex !== index);
    setConfig((prev: any) => ({ ...prev, models: nextModels }));
    setModelExtraParamsText(buildExtraParamsTextMap(nextModels));
    setExpandedModel((prev) => {
      if (prev === null) {
        return prev;
      }
      if (prev === index) {
        return null;
      }
      return prev > index ? prev - 1 : prev;
    });
  };

  const updateModelExtraParamsText = (index: number, value: string) => {
    setModelExtraParamsText((prev) => ({ ...prev, [index]: value }));
    if (!value.trim()) {
      updateModel(index, 'extra_params', {});
      return;
    }
    try {
      updateModel(index, 'extra_params', JSON.parse(value));
    } catch {
      // 允许临时输入无效 JSON，保存时统一校验
    }
  };

  const hasInvalidExtraParams = (index: number) => {
    const rawValue = modelExtraParamsText[index] ?? '{}';
    if (!rawValue.trim()) {
      return false;
    }
    try {
      JSON.parse(rawValue);
      return false;
    } catch {
      return true;
    }
  };

  const updateMcpServer = (index: number, field: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      newConfig.mcp_servers[index][field] = value;
      return newConfig;
    });
  };

  const updateCodingAgent = (field: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      if (!newConfig.coding_agent) {
        newConfig.coding_agent = { tui_username: 'User', preferred_terminal: '', max_parallel_researchers: 6, cache_ttl_hours: 24 };
      }
      newConfig.coding_agent[field] = value;
      return newConfig;
    });
  };

  const updateModelProfile = (index: number, field: string, value: any) => {
    setConfig((prev: any) => {
      const newConfig = { ...prev };
      if (!newConfig.model_profiles) newConfig.model_profiles = [];
      newConfig.model_profiles[index] = { ...newConfig.model_profiles[index], [field]: value };
      return newConfig;
    });
  };

  const addModelProfile = () => {
    setConfig((prev: any) => ({
      ...prev,
      model_profiles: [...(prev.model_profiles || []), {
        profile_name: 'new-profile',
        model_name: '',
        tags: [],
        description: '',
        temperature: 0.5,
        max_tokens: 16384,
      }],
    }));
  };

  const removeModelProfile = (index: number) => {
    setConfig((prev: any) => ({
      ...prev,
      model_profiles: (prev.model_profiles || []).filter((_: any, i: number) => i !== index),
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><RefreshCw className="animate-spin text-blue-500 w-8 h-8" /></div>;
  }

  if (error && !config) {
    return <div className="p-8 text-center text-red-500 font-medium">{error}</div>;
  }

  const tabs = [
    { id: 'general', label: '常规', icon: User },
    { id: 'models', label: '模型与 API', icon: Cpu },
    { id: 'mcp', label: 'MCP 服务器', icon: Network },
    { id: 'advanced', label: '高级设置', icon: SettingsIcon },
    { id: 'about', label: '关于', icon: Info },
  ];

  return (
    <div className="flex h-full bg-white dark:bg-[#1e1e1e]">
      {/* 侧边栏 */}
      <div className="w-56 bg-white dark:bg-[#1e1e1e] flex flex-col shrink-0 px-2">
        <div className="p-2 pt-4">
          <div className="space-y-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[14px] rounded-full transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#f0f0f0] dark:bg-[#333333] text-gray-900 dark:text-gray-100 font-medium'
                    : 'text-gray-600 dark:text-[#a0a0a0] hover:bg-gray-50 dark:hover:bg-[#2b2b2b]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 overflow-y-auto p-8 relative bg-white dark:bg-[#1e1e1e]">
          <div className="max-w-3xl space-y-10 pb-10">
            
            {activeTab === 'general' && (
              <div className="animate-in fade-in duration-300">
                
                <Section title="身份与称呼">
                  <SettingRow label="AI 昵称 (Nickname)" description="机器人的主要名字，如 MoFox" border={true}>
                    <SettingInput value={config?.personality?.nickname || ''} onChange={(e: any) => updateNestedConfig(['personality', 'nickname'], e.target.value)} placeholder="例如: MoFox" />
                  </SettingRow>
                  <SettingRow label="别名 (Alias Names)" description="机器人的其他名字，逗号分隔" border={false}>
                    <SettingInput value={config?.personality?.alias_names?.join(', ') || ''} onChange={(e: any) => updateNestedConfig(['personality', 'alias_names'], e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="例如: 小狐狸, 莫狐" />
                  </SettingRow>
                </Section>
                
                <Section title="性格设定">
                  <SettingRow label="身份设定 (System Identity)" description="描述 AI 的背景和基础系统设定" border={true}>
                    <textarea value={config?.personality?.identity || ''} onChange={(e) => updateNestedConfig(['personality', 'identity'], e.target.value)} rows={2} className="w-full px-3 py-1.5 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-gray-100 transition-colors resize-none" placeholder="描述 AI 的背景和基础系统设定" />
                  </SettingRow>
                  <SettingRow label="核心设定 (Core)" description="AI 的核心性格设定" border={true}>
                    <textarea value={config?.personality?.personality_core || ''} onChange={(e) => updateNestedConfig(['personality', 'personality_core'], e.target.value)} rows={3} className="w-full px-3 py-1.5 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-gray-100 transition-colors resize-none" placeholder="AI 的核心性格设定" />
                  </SettingRow>
                  <SettingRow label="扩展设定 (Side)" description="AI 的扩展细节、口头禅等" border={true}>
                    <textarea value={config?.personality?.personality_side || ''} onChange={(e) => updateNestedConfig(['personality', 'personality_side'], e.target.value)} rows={3} className="w-full px-3 py-1.5 text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-gray-100 transition-colors resize-none" placeholder="AI 的扩展细节、口头禅等" />
                  </SettingRow>
                  <SettingRow label="回复风格 (Reply Style)" border={false}>
                    <SettingInput value={config?.personality?.reply_style || ''} onChange={(e: any) => updateNestedConfig(['personality', 'reply_style'], e.target.value)} placeholder="例如: 自然口语化" />
                  </SettingRow>
                </Section>
              </div>
            )}

            {activeTab === 'models' && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-6 flex justify-end">
                  <div className="flex gap-2">
                    <button onClick={() => setConfig((prev: any) => ({ ...prev, api_providers: [...prev.api_providers, { name: 'new_provider', client_type: 'openai', api_key: '', base_url: '' }] }))} className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-full shadow-sm transition-colors">
                      <Plus size={14} /> 添加供应商
                    </button>
                    <button onClick={addModel} className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-full shadow-sm transition-colors">
                      <Plus size={14} /> 添加模型
                    </button>
                  </div>
                </div>

                <Section title="API 供应商">
                  {config?.api_providers?.map((provider: any, idx: number) => (
                    <div key={idx} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 relative group p-4 space-y-4">
                      {config.api_providers.length > 1 && (
                        <button onClick={() => setConfig((prev: any) => { const newConfig = { ...prev }; newConfig.api_providers.splice(idx, 1); return newConfig; })} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors opacity-0 group-hover:opacity-100" title="删除供应商">
                          <Trash2 size={16} />
                        </button>
                      )}
                      <div className="grid grid-cols-2 gap-4 pr-10">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">供应商名称</label>
                          <SettingInput value={provider.name} onChange={(e: any) => updateProvider(idx, 'name', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">客户端类型</label>
                          <SettingSelect value={provider.client_type} onChange={(e: any) => updateProvider(idx, 'client_type', e.target.value)}>
                            <option value="openai">OpenAI 兼容</option>
                            <option value="anthropic">Anthropic</option>
                            <option value="google">Google</option>
                          </SettingSelect>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">API Key</label>
                          <SettingInput type="password" value={provider.api_key} onChange={(e: any) => updateProvider(idx, 'api_key', e.target.value)} placeholder="sk-..." className="font-mono text-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Base URL (选填)</label>
                          <SettingInput value={provider.base_url} onChange={(e: any) => updateProvider(idx, 'base_url', e.target.value)} placeholder="默认" className="font-mono text-xs" />
                        </div>
                      </div>
                    </div>
                  ))}
                </Section>

                <Section title="可用模型列表">
                  {config?.models?.map((model: any, idx: number) => (
                    <div key={idx} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 relative">
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-[#252526]/30 transition-colors">
                        <button onClick={() => setExpandedModel(expandedModel === idx ? null : idx)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors flex-shrink-0">
                          {expandedModel === idx ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <div className="flex-1 grid grid-cols-12 gap-3">
                          <div className="col-span-5 flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 w-6 shrink-0">ID</span>
                            <SettingInput value={model.model_id} onChange={(e: any) => updateModel(idx, 'model_id', e.target.value)} placeholder="gpt-4o" />
                          </div>
                          <div className="col-span-4 flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 w-10 shrink-0">服务商</span>
                            <SettingSelect value={model.api_provider} onChange={(e: any) => updateModel(idx, 'api_provider', e.target.value)}>
                              {config.api_providers?.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
                            </SettingSelect>
                          </div>
                          <div className="col-span-3 flex items-center gap-2 pr-8">
                            <span className="text-xs font-medium text-gray-500 shrink-0">MaxCtx</span>
                            <SettingInput value={model.max_context || ''} onChange={(e: any) => updateModel(idx, 'max_context', e.target.value)} placeholder="128k" />
                          </div>
                        </div>
                        <button onClick={() => removeModel(idx)} className="absolute right-4 p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      {expandedModel === idx && (
                        <div className="px-12 py-4 bg-gray-50/50 dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-gray-800/60 space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-medium text-gray-500">输入价 ($/M)</label>
                              <SettingInput value={model.price_in ?? ''} onChange={(e: any) => updateModel(idx, 'price_in', e.target.value)} placeholder="0.0" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-medium text-gray-500">输出价 ($/M)</label>
                              <SettingInput value={model.price_out ?? ''} onChange={(e: any) => updateModel(idx, 'price_out', e.target.value)} placeholder="0.0" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-medium text-gray-500">缓存输入价</label>
                              <SettingInput value={model.cache_hit_price_in ?? ''} onChange={(e: any) => updateModel(idx, 'cache_hit_price_in', e.target.value)} placeholder="默认" />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                              <ToggleSwitch checked={model.force_stream_mode === true} onChange={(val) => updateModel(idx, 'force_stream_mode', val)} />
                              强制流式
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                              <ToggleSwitch checked={model.tool_call_compat === true} onChange={(val) => updateModel(idx, 'tool_call_compat', val)} />
                              工具兼容
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                              <ToggleSwitch checked={model.anti_truncation === true} onChange={(val) => updateModel(idx, 'anti_truncation', val)} />
                              防截断
                            </label>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-medium text-gray-500">Extra Params (JSON)</label>
                            <textarea
                              value={modelExtraParamsText[idx] ?? JSON.stringify(model.extra_params ?? {}, null, 2)}
                              onChange={(e) => updateModelExtraParamsText(idx, e.target.value)}
                              rows={3}
                              className={`w-full px-3 py-2 border rounded-md text-xs font-mono bg-transparent outline-none focus:ring-1 ${
                                hasInvalidExtraParams(idx)
                                  ? 'border-red-300 dark:border-red-700 focus:ring-red-500'
                                  : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'
                              }`}
                              placeholder='{"reasoning_effort":"high"}'
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </Section>

                <Section title="角色绑定 (Role Assignments)">
                  {['main', 'coder', 'researcher', 'reviewer', 'title'].map((role, idx) => (
                    <SettingRow key={role} label={<span className="uppercase text-xs font-semibold">{role}</span>} border={idx !== 4}>
                      <SettingSelect value={config?.roles?.[role] || ''} onChange={(e: any) => updateNestedConfig(['roles', role], e.target.value)}>
                        <option value="">-- 跟随 main --</option>
                        {config?.models?.map((m: any) => {
                          const name = `${m.api_provider}/${m.model_id}`;
                          return <option key={name} value={name}>{name}</option>;
                        })}
                      </SettingSelect>
                    </SettingRow>
                  ))}
                </Section>

                <Section title="Coder Model Profile">
                  <div className="flex justify-end mb-2">
                    <button onClick={addModelProfile} className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-full shadow-sm transition-colors">
                      <Plus size={14} /> 添加 Profile
                    </button>
                  </div>
                  {(!config?.model_profiles || config.model_profiles.length === 0) ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">暂无 Coder Profile，请添加或从 OOBE 生成</div>
                  ) : (
                    config.model_profiles.map((profile: any, idx: number) => (
                      <div key={idx} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0 p-4 space-y-3 relative group">
                        <button onClick={() => removeModelProfile(idx)} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100" title="删除 Profile">
                          <Trash2 size={16} />
                        </button>
                        <div className="grid grid-cols-2 gap-4 pr-8">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Profile 名称</label>
                            <SettingInput value={profile.profile_name || ''} onChange={(e: any) => updateModelProfile(idx, 'profile_name', e.target.value)} placeholder="如: claude-architect" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">模型</label>
                            <SettingSelect value={profile.model_name || ''} onChange={(e: any) => updateModelProfile(idx, 'model_name', e.target.value)}>
                              <option value="">-- 跟随 coder 角色 --</option>
                              {config?.models?.map((m: any) => {
                                const name = `${m.api_provider}/${m.model_id}`;
                                return <option key={name} value={name}>{name}</option>;
                              })}
                            </SettingSelect>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pr-8">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">标签 (逗号分隔)</label>
                            <SettingInput value={(profile.tags || []).join(', ')} onChange={(e: any) => updateModelProfile(idx, 'tags', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))} placeholder="如: 后端, 复杂逻辑" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">适用场景描述</label>
                            <SettingInput value={profile.description || ''} onChange={(e: any) => updateModelProfile(idx, 'description', e.target.value)} placeholder="如: 适合复杂后端架构" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pr-8">
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">Temperature</label>
                            <input type="range" min="0" max="2" step="0.05" value={String(profile.temperature ?? 0.5)} onChange={(e) => updateModelProfile(idx, 'temperature', parseFloat(e.target.value))} className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                            <span className="w-10 text-right text-sm font-mono text-gray-900 dark:text-gray-100">{profile.temperature ?? 0.5}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">Max Tokens</label>
                            <SettingInput type="number" value={String(profile.max_tokens ?? 16384)} onChange={(e: any) => updateModelProfile(idx, 'max_tokens', parseInt(e.target.value) || 16384)} className="font-mono text-right" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </Section>
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="animate-in fade-in duration-300">
                <div className="mb-6 flex justify-end">
                  <button onClick={() => setConfig((prev: any) => ({ ...prev, mcp_servers: [...(prev.mcp_servers || []), { name: 'new-server', command: 'npx', args: ['-y', 'mcp-server'], enabled: true }] }))} className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 px-3 py-1.5 rounded-full shadow-sm transition-colors">
                    <Plus size={14} /> 添加端点
                  </button>
                </div>

                <Section title="已配置的端点">
                  {(!config?.mcp_servers || config.mcp_servers.length === 0) ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      暂未配置任何 MCP 服务器。
                    </div>
                  ) : (
                    config.mcp_servers.map((server: any, idx: number) => (
                      <div key={idx} className={`border-b border-gray-100 dark:border-gray-800/60 last:border-0 relative p-4 transition-all flex flex-col gap-3 group ${server.enabled === false ? 'opacity-60 grayscale' : ''}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <ToggleSwitch checked={server.enabled !== false} onChange={(val) => updateMcpServer(idx, 'enabled', val)} />
                            <input type="text" value={server.name} onChange={(e) => updateMcpServer(idx, 'name', e.target.value)} className="text-sm font-semibold bg-transparent outline-none focus:border-b border-gray-300 dark:border-gray-600 w-1/2 text-gray-900 dark:text-white" placeholder="服务器名称" />
                          </div>
                          <button onClick={() => setConfig((prev: any) => { const newConfig = { ...prev }; newConfig.mcp_servers.splice(idx, 1); return newConfig; })} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex gap-3 pl-12 pr-6">
                          <div className="w-1/4">
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">命令 (Command)</label>
                            <SettingInput value={server.command} onChange={(e: any) => updateMcpServer(idx, 'command', e.target.value)} placeholder="e.g. npx" />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">参数 (Args - 空格分隔)</label>
                            <SettingInput value={Array.isArray(server.args) ? server.args.join(' ') : server.args} onChange={(e: any) => { const arr = e.target.value.split(' ').filter(Boolean); updateMcpServer(idx, 'args', arr); }} placeholder="-y @modelcontextprotocol/server" className="font-mono" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </Section>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="animate-in fade-in duration-300">

                <Section title="全局参数">
                  <SettingRow label="全局 Temperature" description="控制回答的随机性和创造性 (0.0 - 0.5)" border={true}>
                    <div className="flex items-center gap-3 w-full">
                      <input type="range" min="0" max="2" step="0.1" value={String(config?.model_profiles?.[0]?.temperature || 0.5)} onChange={(e) => updateNestedConfig(['model_profiles', '0', 'temperature'], parseFloat(e.target.value))} className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                      <span className="w-10 text-right text-sm font-mono text-gray-900 dark:text-gray-100">
                        {config?.model_profiles?.[0]?.temperature || 0.5}
                      </span>
                    </div>
                  </SettingRow>
                  <SettingRow label="全局 Max Tokens" description="单次回复生成的最大 Token 数量" border={false}>
                    <SettingInput type="number" value={String(config?.model_profiles?.[0]?.max_tokens || 16384)} onChange={(e: any) => updateNestedConfig(['model_profiles', '0', 'max_tokens'], parseInt(e.target.value))} className="font-mono text-right" />
                  </SettingRow>
                </Section>

                <Section title="Coding Agent">
                  <SettingRow label="用户称呼" border={true}>
                    <SettingInput value={config?.coding_agent?.tui_username || 'User'} onChange={(e: any) => updateCodingAgent('tui_username', e.target.value)} placeholder="User" className="text-right" />
                  </SettingRow>
                  <SettingRow label="首选终端环境" border={true}>
                    <SettingSelect value={config?.coding_agent?.preferred_terminal || ''} onChange={(e: any) => updateCodingAgent('preferred_terminal', e.target.value)}>
                      <option value="">自动检测</option>
                      <option value="powershell">PowerShell 5</option>
                      <option value="pwsh">PowerShell 7</option>
                      <option value="cmd">CMD</option>
                      <option value="bash">Bash</option>
                    </SettingSelect>
                  </SettingRow>
                  <SettingRow label="最大并行研究员数" border={true}>
                    <SettingInput type="number" min={1} max={20} value={config?.coding_agent?.max_parallel_researchers || 6} onChange={(e: any) => updateCodingAgent('max_parallel_researchers', parseInt(e.target.value) || 6)} className="text-right font-mono" />
                  </SettingRow>
                  <SettingRow label="缓存有效期" description="小时" border={false}>
                    <SettingInput type="number" min={1} max={720} value={config?.coding_agent?.cache_ttl_hours || 24} onChange={(e: any) => updateCodingAgent('cache_ttl_hours', parseInt(e.target.value) || 24)} className="text-right font-mono" />
                  </SettingRow>
                </Section>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="animate-in fade-in duration-300">
                
                <Section title="系统信息">
                  {[
                    { label: 'MoFox Code Desktop', key: 'desktop' },
                    { label: 'Neo-MoFox 框架', key: 'framework' },
                    { label: 'coding_agent 插件', key: 'coding_agent' },
                    { label: 'coding_agent_webui 插件', key: 'coding_agent_webui' },
                  ].map(({ label, key }, idx) => (
                    <SettingRow key={key} label={label} border={idx !== 3}>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {version?.[key] ?? <RefreshCw className="animate-spin inline w-3 h-3" />}
                      </span>
                    </SettingRow>
                  ))}
                </Section>
              </div>
            )}

          </div>
        </div>

        {/* 底部保存条 */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800/60 bg-[#f9fafb]/80 dark:bg-[#111111]/80 backdrop-blur-md flex items-center justify-end gap-3 shrink-0 z-10 absolute bottom-0 left-0 right-0">
          {error && <span className="text-red-500 text-sm font-medium flex items-center mr-auto">{error}</span>}
          {saveSuccess && <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center mr-auto animate-in fade-in zoom-in duration-200">✓ 配置已保存，正在重启...</span>}
          <button onClick={onClose} className="px-5 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            取消
          </button>
          <button onClick={handleSave} disabled={saving || saveSuccess} className="px-5 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {saving ? '保存中...' : saveSuccess ? '已保存' : '保存更改并重启'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
