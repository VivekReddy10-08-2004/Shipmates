// Jacob Craig
import client from "./axiosClient.js"; 

// interfaces
export interface Resource {
  id: any;
  resource_id: any;
  title: string;
  description: string;
  filetype: string;
}

// GET /resources
export async function fetchResources(limit = 0) {
  const params: { limit?: number } = {};
  if (limit > 0) {
    params.limit = limit;
  }

  const res = await client.get("/resources", { params });
  return res.data;
}

// POST /resources 
export async function createResource(payload: any) {
  // payload: { title, description, filetype, url }
  const res = await client.post("/resources", payload);
  return res.data;
}

// POST /resources/upload-file 
export async function uploadResourceFile(formData: any) {
  const res = await client.post("/resources/upload-file", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

