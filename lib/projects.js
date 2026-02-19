import { apiRequest } from './api.js';
import { formatTable, colors, log } from './utils.js';

// List all projects
export async function listProjects() {
  const response = await apiRequest('/api/projects/getList');

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to list projects');
  }

  const projects = response.data?.projects || [];

  if (projects.length === 0) {
    log('info', 'No projects found. Create one with: node cli.js projects create <name>');
    return [];
  }

  const columns = [
    { key: 'projectID', label: 'ID' },
    { key: 'project_name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'networkCIDR', label: 'Network CIDR' }
  ];

  console.log(`\n${colors.bold}Projects (${projects.length})${colors.reset}\n`);
  console.log(formatTable(projects, columns));
  console.log('');

  return projects;
}

// Create a new project
export async function createProject(name, description = '', technicalEmails = '') {
  if (!name) {
    throw new Error('Project name is required');
  }

  const response = await apiRequest('/api/projects/addProject', 'POST', {
    name,
    description,
    technicalEmails
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to create project');
  }

  log('success', `Project "${name}" created`);
  return response;
}

// Edit a project
export async function editProject(projectId, name, description, technicalEmails) {
  const body = { projectId: String(projectId) };
  if (name) body.name = name;
  if (description !== undefined) body.description = description;
  if (technicalEmails !== undefined) body.technicalEmails = technicalEmails;

  const response = await apiRequest('/api/projects/editProject', 'PUT', body);

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to edit project');
  }

  log('success', `Project ${projectId} updated`);
  return response;
}

// Delete a project
export async function deleteProject(projectId, force = false) {
  if (!force) {
    throw new Error('Deleting a project requires --force flag to confirm');
  }

  const response = await apiRequest('/api/projects/deleteProject', 'DELETE', {
    projectId: String(projectId)
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to delete project');
  }

  log('success', `Project ${projectId} deleted`);
  return response;
}

// List project members
export async function listMembers(projectId) {
  const response = await apiRequest('/api/projects/getMembersList', 'GET', {
    projectId: String(projectId)
  });

  // API may return array directly
  let members = [];
  if (Array.isArray(response)) {
    members = response;
  } else if (response.status === 'OK') {
    members = response.data?.projectMembers || response.data?.members || [];
  } else if (response.status === 'KO' || response.message) {
    throw new Error(response.message || 'Failed to list members');
  }

  if (members.length === 0) {
    log('info', 'No members found');
    return [];
  }

  const columns = [
    { key: 'userID', label: 'User ID' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' }
  ];

  console.log(`\n${colors.bold}Project Members${colors.reset}\n`);
  console.log(formatTable(members, columns));
  console.log('');

  return members;
}

// Add a member to project
export async function addMember(projectId, email, role = 'admin') {
  const response = await apiRequest('/api/projects/addMember', 'POST', {
    projectId: String(projectId),
    targetEmail: email,
    role
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to add member');
  }

  log('success', `Added ${email} as ${role} to project ${projectId}`);
  return response;
}

// Update member role
export async function updateMember(projectId, memberId, role) {
  const response = await apiRequest('/api/projects/updateMember', 'PUT', {
    projectId: String(projectId),
    targetId: String(memberId),
    role
  });

  if (response.status !== 'OK') {
    throw new Error(response.message || 'Failed to update member');
  }

  log('success', `Updated member ${memberId} role to ${role}`);
  return response;
}

// Remove member from project
export async function removeMember(projectId, memberId) {
  const response = await apiRequest('/api/projects/deleteMember', 'DELETE', {
    projectId: String(projectId),
    targetId: String(memberId)
  });

  if (response.status !== 'OK' && response.status !== undefined) {
    throw new Error(response.message || 'Failed to remove member');
  }

  log('success', `Removed member ${memberId} from project ${projectId}`);
  return response;
}
