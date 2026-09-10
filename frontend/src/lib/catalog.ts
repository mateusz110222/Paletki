export type CatalogEntry = {
    id: number;
    kind: 'project' | 'model';
    name: string;
    project?: string;
    projectId?: number;
};

export function getCatalogAdminUrl(entry: CatalogEntry): string {
    const params = new URLSearchParams();
    params.set('project', entry.kind === 'project' ? entry.name : entry.project ?? '');
    if (entry.kind === 'model') params.set('model', entry.name);
    return `/admin?${params.toString()}`;
}

export function getCatalogEntries(
    projects: readonly {id: number; name: string}[],
    models: readonly {id: number; name: string; project_id: number}[],
    tab: CatalogEntry['kind'],
    search: string,
    projectId: number | null,
): CatalogEntry[] {
    const query = search.trim().toLocaleLowerCase();
    const entries: CatalogEntry[] = projects.flatMap(project => {
        const children: CatalogEntry[] = models
            .filter(model => model.project_id === project.id)
            .map(model => ({
                id: model.id,
                kind: 'model',
                name: model.name,
                project: project.name,
                projectId: project.id,
            }));
        return [{id: project.id, kind: 'project', name: project.name} as CatalogEntry, ...children];
    });

    return entries.filter(entry =>
        entry.kind === tab
        && (tab !== 'model' || projectId === null || entry.projectId === projectId)
        && `${entry.name} ${entry.project ?? ''}`.toLocaleLowerCase().includes(query),
    );
}
