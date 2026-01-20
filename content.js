// 1. Create the HTML video element in memory
const videoElement = document.createElement('video');

// 2. Configure the video settings
videoElement.style.position = "fixed";      // Stuck to the screen (doesn't scroll)
videoElement.style.top = "10px";         // 10px from the bottom
videoElement.style.right = "10px";          // 10px from the right
videoElement.style.width = "160px";         // Small size
videoElement.style.height = "120px";
videoElement.style.zIndex = "9999";         // Sit on top of everything else
videoElement.style.transform = "scaleX(-1)";// Mirror the feed (natural feel)
videoElement.style.borderRadius = "10px";   // Rounded corners (looks nice)
videoElement.style.objectFit = "cover";     // Fill the box without stretching
videoElement.autoplay = true;               // Start playing immediately
videoElement.muted = true;                  // No audio (prevents feedback loops)

// 3. Inject the video into the actual webpage
document.body.appendChild(videoElement);

// 4. Request access to the user's webcam
navigator.mediaDevices.getUserMedia({ video: true })
  .then((stream) => {
    // SUCCESS: If the user clicks "Allow"
    console.log("NeuroNav: Camera access granted.");
    videoElement.srcObject = stream; // Connect the camera stream to the video element
  })
  .catch((error) => {
    // ERROR: If the user clicks "Block" or has no camera
    console.error("NeuroNav Error:", error);
  });