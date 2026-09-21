import { createHrClient, HR_FIELDS } from '../hr-client.js';
try {
  const employees = await createHrClient({ apiKey: process.env.DATA_API_KEY, baseUrl: process.env.DATA_API_URL }).all();
  console.log(JSON.stringify({
    connected: true, count: employees.length,
    departments: new Set(employees.map(row => row.DEPT_CD).filter(Boolean)).size,
    blankDepartment: employees.filter(row => !row.DEPT_CD).length,
    blankEmail: employees.filter(row => !row.USER_EMAIL).length,
    duplicateIds: employees.length - new Set(employees.map(row => row.USER_ID)).size,
    fields: HR_FIELDS
  }));
} catch (error) {
  console.error(JSON.stringify({ connected: false, code: error.code || 'HR_CHECK_FAILED' }));
  process.exitCode = 1;
}
