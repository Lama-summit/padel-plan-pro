import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Project, ProjectVersion, DEFAULT_INPUTS } from "./types";

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function createVersion(name: string): ProjectVersion {
  return {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    inputs: { ...DEFAULT_INPUTS },
  };
}

const SAMPLE_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Padel Barcelona Central",
    location: "Barcelona, Spain",
    currency: "EUR",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-03-20T14:30:00Z",
    status: "active",
    versions: [
      {
        id: "v1-1",
        name: "Initial Plan",
        createdAt: "2025-01-15T10:00:00Z",
        inputs: { ...DEFAULT_INPUTS },
      },
      {
        id: "v1-2",
        name: "Revised Budget",
        createdAt: "2025-02-10T10:00:00Z",
        inputs: { ...DEFAULT_INPUTS, numberOfCourts: 6, initialInvestment: 750000 },
      },
    ],
    activeVersionId: "v1-2",
  },
  {
    id: "proj-2",
    name: "Padel Lisboa Premium",
    location: "Lisbon, Portugal",
    currency: "EUR",
    createdAt: "2025-02-01T10:00:00Z",
    updatedAt: "2025-03-18T09:00:00Z",
    status: "draft",
    versions: [
      {
        id: "v2-1",
        name: "V1",
        createdAt: "2025-02-01T10:00:00Z",
        inputs: { ...DEFAULT_INPUTS, numberOfCourts: 3, courtType: "outdoor", initialInvestment: 300000 },
      },
    ],
    activeVersionId: "v2-1",
  },
];

interface StoreContextType {
  projects: Project[];
  createProject: (name: string, location: string, currency: string) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  createVersion: (projectId: string, name: string) => void;
  createVersionFromCurrent: (projectId: string, name: string) => void;
  duplicateVersion: (projectId: string, versionId: string) => void;
  saveVersion: (projectId: string, versionId: string) => void;
  updateVersionInputs: (projectId: string, versionId: string, inputs: Partial<ProjectVersion["inputs"]>) => void;
  setActiveVersion: (projectId: string, versionId: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

const STORAGE_KEY = "padel-sim-projects";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : SAMPLE_PROJECTS;
    } catch {
      return SAMPLE_PROJECTS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const createProjectFn = useCallback((name: string, location: string, currency: string) => {
    const v = createVersion("V1");
    const project: Project = {
      id: generateId(),
      name,
      location,
      currency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
      versions: [v],
      activeVersionId: v.id,
    };
    setProjects((p) => [...p, project]);
    return project;
  }, []);

  const updateProjectFn = useCallback((id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
    );
  }, []);

  const deleteProjectFn = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const getProjectFn = useCallback((id: string) => projects.find((p) => p.id === id), [projects]);

  const createVersionFn = useCallback((projectId: string, name: string) => {
    const v = createVersion(name);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, versions: [...p.versions, v], activeVersionId: v.id, updatedAt: new Date().toISOString() }
          : p
      )
    );
  }, []);

  const duplicateVersionFn = useCallback((projectId: string, versionId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const source = p.versions.find((v) => v.id === versionId);
        if (!source) return p;
        const dup: ProjectVersion = {
          id: generateId(),
          name: `${source.name} (copy)`,
          createdAt: new Date().toISOString(),
          inputs: { ...source.inputs },
        };
        return { ...p, versions: [...p.versions, dup], activeVersionId: dup.id, updatedAt: new Date().toISOString() };
      })
    );
  }, []);

  const updateVersionInputsFn = useCallback(
    (projectId: string, versionId: string, inputs: Partial<ProjectVersion["inputs"]>) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            versions: p.versions.map((v) =>
              v.id === versionId ? { ...v, inputs: { ...v.inputs, ...inputs } } : v
            ),
          };
        })
      );
    },
    []
  );

  const setActiveVersionFn = useCallback((projectId: string, versionId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, activeVersionId: versionId } : p))
    );
  }, []);

  return (
    <StoreContext.Provider
      value={{
        projects,
        createProject: createProjectFn,
        updateProject: updateProjectFn,
        deleteProject: deleteProjectFn,
        getProject: getProjectFn,
        createVersion: createVersionFn,
        duplicateVersion: duplicateVersionFn,
        updateVersionInputs: updateVersionInputsFn,
        setActiveVersion: setActiveVersionFn,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}
