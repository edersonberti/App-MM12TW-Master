import { supabase } from '../lib/supabase';

export interface DeviceCatalogItem {
  id: string;
  model: string;
  motor_count: number;
  has_filter_timer?: boolean;
  has_led_timer?: boolean;
  has_hidro_timer?: boolean;
  has_solar_heating?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
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
  motorCount: number,
  hasFilterTimer: boolean = true,
  hasLedTimer: boolean = true,
  hasHidroTimer: boolean = true,
  hasSolarHeating: boolean = true
): Promise<DeviceCatalogItem | null> {
  const payload: any = {
    model: model.trim().toUpperCase(),
    motor_count: motorCount,
    has_filter_timer: hasFilterTimer,
    has_led_timer: hasLedTimer,
    has_hidro_timer: hasHidroTimer,
    has_solar_heating: hasSolarHeating,
  };

  let { data, error } = await supabase
    .from('devices_catalog')
    .insert(payload)
    .select()
    .single();

  if (error && (error.message.includes('column') || error.code === 'PGRST204')) {
    // If table doesn't have custom columns yet, fallback to inserting core fields
    const fallbackPayload = {
      model: model.trim().toUpperCase(),
      motor_count: motorCount,
    };
    const retry = await supabase
      .from('devices_catalog')
      .insert(fallbackPayload)
      .select()
      .single();
    
    if (retry.error) {
      console.error('[DevicesCatalogService] Error creating catalog item fallback:', retry.error.message);
      throw retry.error;
    }
    data = {
      ...retry.data,
      has_filter_timer: hasFilterTimer,
      has_led_timer: hasLedTimer,
      has_hidro_timer: hasHidroTimer,
      has_solar_heating: hasSolarHeating,
    };
    return data;
  }

  if (error) {
    console.error('[DevicesCatalogService] Error creating catalog item:', error.message);
    throw error;
  }

  return data;
}

export async function updateDeviceCatalogItem(
  id: string,
  model: string,
  motorCount: number,
  hasFilterTimer: boolean = true,
  hasLedTimer: boolean = true,
  hasHidroTimer: boolean = true,
  hasSolarHeating: boolean = true
): Promise<DeviceCatalogItem | null> {
  const payload: any = {
    model: model.trim().toUpperCase(),
    motor_count: motorCount,
    has_filter_timer: hasFilterTimer,
    has_led_timer: hasLedTimer,
    has_hidro_timer: hasHidroTimer,
    has_solar_heating: hasSolarHeating,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from('devices_catalog')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error && (error.message.includes('column') || error.code === 'PGRST204')) {
    const fallbackPayload = {
      model: model.trim().toUpperCase(),
      motor_count: motorCount,
      updated_at: new Date().toISOString(),
    };
    const retry = await supabase
      .from('devices_catalog')
      .update(fallbackPayload)
      .eq('id', id)
      .select()
      .single();

    if (retry.error) {
      console.error('[DevicesCatalogService] Error updating catalog item fallback:', retry.error.message);
      throw retry.error;
    }
    data = {
      ...retry.data,
      has_filter_timer: hasFilterTimer,
      has_led_timer: hasLedTimer,
      has_hidro_timer: hasHidroTimer,
      has_solar_heating: hasSolarHeating,
    };
    return data;
  }

  if (error) {
    console.error('[DevicesCatalogService] Error updating catalog item:', error.message);
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
