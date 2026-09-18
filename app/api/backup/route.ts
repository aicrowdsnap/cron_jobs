import { NextResponse } from 'next/server';
import { runDatabaseBackup } from '@/scripts/db-backup';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('[API] CRON_SECRET is not configured.');
    return NextResponse.json({ 
      success: false, 
      error: 'Server configuration error.' 
    }, { status: 500 });
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    console.warn('[API] Blocked unauthorized backup attempt.');
    return NextResponse.json({ 
      success: false, 
      error: 'Unauthorized' 
    }, { status: 401 });
  }

  try {
    console.log('[API] Triggering database backup...');
    const result = await runDatabaseBackup();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database backup completed and uploaded successfully.',
      data: result
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('[API] Backup critical failure:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Backup failed to complete', 
      details: error?.message || 'Unknown execution error'
    }, { status: 500 });
  }
}