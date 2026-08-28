import {useMemo, useState} from 'react';
import {Pallet, Project} from '@backend/shared/types';

export interface ProjectStats {
    name: string;
    total: number;
    active: number;
    damaged: number;
    washing: number;
    blocked: number;
    percentage: number;
}

export interface FleetSummary {
    total: number;
    active: number;
    damaged: number;
    washing: number;
    blocked: number;
    availabilityPercentage: number;
}

export type MonitorSortOption = 'alphabetical' | 'lowest_health' | 'highest_health' | 'most_pallets';

interface UseLiveMonitorProps {
    pallets: Pallet[];
    projects?: Project[];
}

export const useLiveMonitor = ({pallets, projects = []}: UseLiveMonitorProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<MonitorSortOption>('alphabetical');

    // Single-pass O(N) calculation of project stats and fleet summary
    const {projectStatsMap, fleetSummary, allProjects} = useMemo(() => {
        const statsMap = new Map<string, ProjectStats>();
        const summary: FleetSummary = {
            total: 0,
            active: 0,
            damaged: 0,
            washing: 0,
            blocked: 0,
            availabilityPercentage: 100,
        };

        // Initialize known registered projects
        if (projects && projects.length > 0) {
            for (const proj of projects) {
                if (proj && proj.name) {
                    statsMap.set(proj.name, {
                        name: proj.name,
                        total: 0,
                        active: 0,
                        damaged: 0,
                        washing: 0,
                        blocked: 0,
                        percentage: 100,
                    });
                }
            }
        }

        if (pallets && pallets.length > 0) {
            for (const p of pallets) {
                const projName = p.project || 'Unknown';
                let stat = statsMap.get(projName);
                if (!stat) {
                    stat = {
                        name: projName,
                        total: 0,
                        active: 0,
                        damaged: 0,
                        washing: 0,
                        blocked: 0,
                        percentage: 0,
                    };
                    statsMap.set(projName, stat);
                }

                stat.total += 1;
                summary.total += 1;

                if (p.status === 'Active') {
                    stat.active += 1;
                    summary.active += 1;
                } else if (p.status === 'Damaged') {
                    stat.damaged += 1;
                    summary.damaged += 1;
                } else if (p.status === 'Washing_Required') {
                    stat.washing += 1;
                    summary.washing += 1;
                } else if (p.status === 'Blocked') {
                    stat.blocked += 1;
                    summary.blocked += 1;
                }
            }
        }

        for (const stat of statsMap.values()) {
            stat.percentage = stat.total > 0 ? Math.round((stat.active / stat.total) * 100) : 100;
        }

        summary.availabilityPercentage = summary.total > 0
            ? Math.round((summary.active / summary.total) * 100)
            : 100;

        const sortedProjNames = Array.from(statsMap.keys()).sort((a, b) => a.localeCompare(b));

        return {
            projectStatsMap: statsMap,
            fleetSummary: summary,
            allProjects: sortedProjNames,
        };
    }, [pallets, projects]);

    // Filter and sort projects based on user input
    const filteredProjects = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let list = allProjects.map(name => projectStatsMap.get(name)!);

        if (query) {
            list = list.filter(item => item.name.toLowerCase().includes(query));
        }

        switch (sortBy) {
            case 'lowest_health':
                list.sort((a, b) => a.percentage - b.percentage || a.name.localeCompare(b.name));
                break;
            case 'highest_health':
                list.sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
                break;
            case 'most_pallets':
                list.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
                break;
            case 'alphabetical':
            default:
                list.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }

        return list;
    }, [allProjects, projectStatsMap, searchQuery, sortBy]);

    return {
        data: {
            fleetSummary,
            projects: filteredProjects,
            totalProjectsCount: allProjects.length,
            searchQuery,
            sortBy,
        },
        actions: {
            setSearchQuery,
            setSortBy,
        },
    };
};
