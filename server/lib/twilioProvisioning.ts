import { twilioClient, twilioAccountSid } from './config';
import { getServiceClient } from './supabase';

/**
 * Purchase a Twilio phone number and provision it as the org's SMS channel.
 * Called server-side only — never from client.
 */
export async function provisionSmsNumber(orgId: string, options?: {
  areaCode?: string;
  country?: string;
}): Promise<{ channelId: string; phoneNumber: string }> {
  if (!twilioClient) {
    throw new Error('Twilio is not configured.');
  }

  const country = options?.country || 'CA';

  // Search for available numbers
  const searchParams: Record<string, any> = { limit: 1, smsEnabled: true, voiceEnabled: false };
  if (options?.areaCode) searchParams.areaCode = options.areaCode;

  const available = await twilioClient
    .availablePhoneNumbers(country)
    .local.list(searchParams);

  if (!available.length) {
    throw new Error(`No SMS-capable numbers available for country=${country}${options?.areaCode ? `, area=${options.areaCode}` : ''}.`);
  }

  const candidate = available[0];

  // Purchase the number
  const purchased = await twilioClient.incomingPhoneNumbers.create({
    phoneNumber: candidate.phoneNumber,
    smsUrl: `${process.env.PUBLIC_URL || ''}/api/messages/inbound`,
    smsMethod: 'POST',
    statusCallback: `${process.env.PUBLIC_URL || ''}/api/messages/status`,
    statusCallbackMethod: 'POST',
    friendlyName: `Lume CRM - ${orgId.slice(0, 8)}`,
  });

  // Save to DB via RPC
  const serviceClient = getServiceClient();
  const { data: channelId, error } = await serviceClient.rpc('provision_sms_channel', {
    p_org_id: orgId,
    p_phone_number: purchased.phoneNumber,
    p_provider: 'twilio',
    p_metadata: {
      twilio_sid: purchased.sid,
      friendly_name: purchased.friendlyName,
      country,
    },
  });

  if (error) throw error;

  return { channelId: channelId as string, phoneNumber: purchased.phoneNumber };
}

/**
 * Get the active SMS channel for an org.
 */
export async function getOrgSmsChannel(orgId: string) {
  const serviceClient = getServiceClient();
  const { data } = await serviceClient
    .from('communication_channels')
    .select('id, phone_number, status, metadata')
    .eq('org_id', orgId)
    .eq('channel_type', 'sms')
    .eq('is_default', true)
    .eq('status', 'active')
    .maybeSingle();
  return data;
}
