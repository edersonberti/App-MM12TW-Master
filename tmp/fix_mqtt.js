const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Target 1: Silence & zombie auto-reconnect
const target1Snippet = "silenceDuration > 25000 && userWantsMqtt";
if (!content.includes(target1Snippet)) {
  console.error("Target 1 snippet not found");
  process.exit(1);
}

// Locate the block starting with // 1f. Periodic check
const startIdx1 = content.indexOf("// 1f. Periodic check:");
const endIdx1 = content.indexOf("// 1g. Backup safety timeout");

if (startIdx1 === -1 || endIdx1 === -1) {
  console.error("Start/End 1 not found");
  process.exit(1);
}

const block1 = content.substring(startIdx1, endIdx1);
const replacement1 = `// 1f. Periodic check: if device is marked as online but hasn't sent any message for > 120 seconds (2 minutes), mark it as offline
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      if (mqttConnected) {
        if (lastMessageTimeRef.current > 0) {
          const silenceDuration = Date.now() - lastMessageTimeRef.current;

          // Mark device as offline if no telemetry message received in 2 minutes
          if (deviceOnline === true && silenceDuration > 120000) {
            console.log('No telemetry received from device in 120 seconds. Marking device as OFFLINE.');
            setDeviceOnline(false);
          }
        }
      }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mqttConnected, deviceOnline, userWantsMqtt]);

  `;

content = content.substring(0, startIdx1) + replacement1 + content.substring(endIdx1);

// Target 2: Initial query topics flood
const startIdx2 = content.indexOf("// Send query commands to request immediate status update");
const endIdx2 = content.indexOf("onFailure: (err: any) => {");

if (startIdx2 === -1 || endIdx2 === -1) {
  console.error("Start/End 2 not found");
  process.exit(1);
}

const replacement2 = `// Send a single query command on connect to request status update from hardware
          const queryTopicsSet = new Set<string>();
          Array.from(idsToProcess).forEach((id) => {
            if (!id) return;
            const cleanId = cleanDeviceId(id);
            if (cleanId) {
              queryTopicsSet.add(\`MLZ/\${cleanId}/cmd\`);
            }
          });

          const queryTopics = Array.from(queryTopicsSet);

          queryTopics.forEach((qt) => {
            try {
              const msg = new window.Paho.MQTT.Message('STATUS');
              msg.destinationName = qt;
              recordOutboundPublish(qt, 'STATUS');
              client.send(msg);
            } catch (err) {
              console.warn(\`Initial query failed on \${qt}:\`, err);
            }
          });
        },
        `;

content = content.substring(0, startIdx2) + replacement2 + content.substring(endIdx2);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Successfully updated app/page.tsx');
