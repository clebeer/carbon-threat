import { apiClient } from './client';

export interface IconDef {
  label: string;
  svgPath: string;
  color: string;
  viewBox?: string;
}

export interface DomainPack {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon_manifest: { nodeTypes: Record<string, IconDef> };
  threat_matrix: Record<string, string[]>;
  is_builtin: boolean;
}

export interface DomainTemplate {
  id: string;
  pack_id: string;
  name: string;
  description?: string;
  diagram_json: { nodes: unknown[]; edges: unknown[] };
}

export async function listPacks(): Promise<DomainPack[]> {
  const { data } = await apiClient.get<{ packs: DomainPack[] }>('/domain-packs');
  return data.packs;
}

export async function getPack(slug: string): Promise<DomainPack> {
  const { data } = await apiClient.get<{ pack: DomainPack }>(`/domain-packs/${slug}`);
  return data.pack;
}

export async function listTemplates(slug: string): Promise<DomainTemplate[]> {
  const { data } = await apiClient.get<{ templates: DomainTemplate[] }>(`/domain-packs/${slug}/templates`);
  return data.templates;
}

export async function applyTemplate(slug: string, templateId: string, title: string): Promise<{ id: string; title: string }> {
  const { data } = await apiClient.post<{ model: { id: string; title: string } }>(
    `/domain-packs/${slug}/templates/${templateId}/apply`,
    { title }
  );
  return data.model;
}
