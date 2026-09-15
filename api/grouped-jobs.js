export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    console.log("[GROUPED CRON] Started execution");

    const results = await Promise.allSettled([
      fetch(process.env.SPEECHTOTEXT_CRON_URL, { 
        method: "POST", 
        headers: { "Content-Type": "application/json", "Accept": "application/json" } 
      }),
      fetch(process.env.NOVAHR_CRON_URL, { 
        method: "POST", 
        headers: { "Authorization": `Bearer ${process.env.NOVAHR_API_TOKEN}`, "Content-Type": "application/json", "Accept": "application/json" } 
      }),
      fetch(process.env.SOBA_POC_CRON_URL, { 
        method: "POST", 
        headers: { "X-API-Key": process.env.SOBA_API_KEY, "Accept": "application/json" } 
      }),
      fetch(process.env.SOBA_PROD_CRON_URL, { 
        method: "POST", 
        headers: { "X-API-Key": process.env.SOBA_API_KEY, "Accept": "application/json" } 
      })
    ]);

    return res.status(200).json({
      success: true,
      message: "All grouped jobs executed",
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[GROUPED CRON] Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}