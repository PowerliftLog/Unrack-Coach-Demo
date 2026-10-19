/** Instructions intentionally exclude the private invite URL: coaches send it separately. */
export function athleteSetupMessage(athleteName: string): string {
  return `Hey ${athleteName.trim() || 'there'} — here's how to get set up in UNRACK! I'll send your personal connection link in a separate message right after this.

On your iPhone:
1. Copy the link from my next message, then open it in Safari.
2. Tap Share → Add to Home Screen → Add.
3. Open UNRACK using the new icon on your Home Screen.
4. Paste the link into the app, tap Review invitation, then Connect this device.
5. Confirm your profile and open your program. Your workouts appear once I publish them.

Make sure you connect inside the app you added to your Home Screen. Connecting in Safari won't carry over to the installed app.

During your workout, enter the weight and reps you actually do, check off each completed set, and add any notes you want me to see. When you're done, tap Finish workout and save the session so it syncs back to me.

The link works once and expires after 48 hours. Send it only to your own device. If anything looks off or you get stuck, send me a screenshot and I'll help you out!`
}
