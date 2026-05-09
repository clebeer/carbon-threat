import React from 'react';
import type { DomainPack } from '../../api/domainPacks';
import { DefaultIcons } from './assets/icons';

export function DomainIcon({ kind, pack }: { kind: string; pack?: DomainPack | null }) {
  const iconDef = pack?.icon_manifest?.nodeTypes?.[kind];
  if (iconDef) {
    return (
      <svg width="20" height="20" viewBox={iconDef.viewBox ?? '0 0 24 24'} fill="none" stroke={iconDef.color ?? 'currentColor'} strokeWidth="1.5">
        <path d={iconDef.svgPath} />
      </svg>
    );
  }
  return <>{DefaultIcons[kind] ?? DefaultIcons.server}</>;
}