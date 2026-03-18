'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  Search,
  Plus,
  GitBranch,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchProjects, openProject } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const frameworkIcons: Record<string, string> = {
  'next.js': '▲',
  'react': '⚛️',
  'fastapi': '🚀',
  'python': '🐍',
  'nodejs': '📦',
  'typescript': '📘',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetchProjects();
        setProjects(response.data.projects);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleOpenProject = async (name: string) => {
    try {
      await openProject(name);
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || project.status === filter;
    return matchesSearch && matchesFilter;
  });

  const activeCount = projects.filter((project) => project.status !== 'archived').length;
  const archivedCount = projects.filter((project) => project.status === 'archived').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 sm:h-12 sm:w-12">
            <FolderOpen className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">Projetos</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {activeCount} ativos · {archivedCount} arquivados
            </p>
          </div>
        </div>
        <Button className="self-start sm:self-auto">
          <Plus className="w-4 h-4 mr-2" />
          Novo Projeto
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-4 rounded-xl border border-white/5 bg-zinc-900 px-4 py-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar projetos..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[var(--cyan)] transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'archived'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Arquivados'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Projects Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredProjects.map((project) => (
          <motion.div key={project.id} variants={item}>
            <Card className="h-full px-0 py-0 transition-colors group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
                      {frameworkIcons[project.framework || ''] || '📁'}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{project.name}</CardTitle>
                      <CardDescription className="text-xs">{project.type || 'workspace'}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={project.status === 'archived' ? 'default' : 'green'}>
                    {project.status || 'active'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[var(--text-muted)] line-clamp-2">
                  {project.description || project.path}
                </p>

                {project.git?.has_repo && (
                  <div className="flex items-center gap-2 text-sm">
                    <GitBranch className="w-4 h-4 text-[var(--gold)]" />
                    <span className="text-[var(--text-secondary)]">{project.git.branch}</span>
                    {project.git.uncommitted_changes > 0 && (
                      <Badge variant="yellow" className="text-xs">
                        {project.git.uncommitted_changes} changes
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-white/5 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Clock className="w-3.5 h-3.5" />
                    {project.last_modified ? new Date(project.last_modified).toLocaleDateString('pt-BR') : 'Agora'}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenProject(project.name)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {filteredProjects.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-50" />
          <p className="text-lg font-medium text-[var(--text-muted)]">
            Nenhum projeto encontrado
          </p>
          <p className="text-sm text-[var(--text-subtle)] mt-1">
            Tente ajustar seus filtros ou criar um novo projeto
          </p>
        </motion.div>
      )}
    </div>
  );
}

