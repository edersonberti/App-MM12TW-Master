import { supabase } from '../lib/supabase';

export interface DeviceCatalogItem {
  id: string;
  model: string;
  motor_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchDeviceCatalog(): Promise<DeviceCatalogItem[]> {
  const { data, error } = await supabase
    .from('devices_catalog')
    .select('*')
    .order('model', { ascending: true });

  if (error) {
    console.error('[DevicesCatalogService] Error fetching catalog:', error.message);
    return [];
  }

  return data || [];
}

export async function createDeviceCatalogItem(
  model: string,
  motorCount: number
): Promise<DeviceCatalogItem | null> {
  const { data, error } = await supabase
    .from('devices_catalog')
    .insert({
      model: model.trim().toUpperCase(),
      motor_count: motorCount,
    })
    .select()
    .single();

  if (error) {
    console.error('[DevicesCatalogService] Error creating catalog item:', error.message);
    throw error;
  }

  return data;
}

export async function deleteDeviceCatalogItem(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('devices_catalog')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[DevicesCatalogService] Error deleting catalog item:', error.message);
    throw error;
  }

  return true;
}
