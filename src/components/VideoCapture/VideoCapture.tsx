import React from "react";
import "../../dynamsoft.config"; // import side effects. The license, engineResourcePath, so on.
import { CameraEnhancer, CameraView } from "dynamsoft-camera-enhancer";
import { CaptureVisionRouter } from "dynamsoft-capture-vision-router";
import { MultiFrameResultCrossFilter } from "dynamsoft-utility";
import "./VideoCapture.css";
import template from "../../template";
const componentDestroyedErrorMsg = "VideoCapture Component Destroyed";

class VideoCapture extends React.Component {
  state = {
    resultText: "",
  };
  cameraViewContainer: React.RefObject<HTMLDivElement> = React.createRef();

  resolveInit?: () => void;
  pInit: Promise<void> = new Promise((r) => (this.resolveInit = r));
  isDestroyed = false;

  cvRouter?: CaptureVisionRouter;
  cameraEnhancer?: CameraEnhancer;

  async componentDidMount() {
    try {
      // Create a `CameraEnhancer` instance for camera control and a `CameraView` instance for UI control.
      const cameraView = await CameraView.createInstance();
      if (this.isDestroyed) {
        throw Error(componentDestroyedErrorMsg);
      } // Check if component is destroyed after every async

      this.cameraEnhancer = await CameraEnhancer.createInstance(cameraView);
      if (this.isDestroyed) {
        throw Error(componentDestroyedErrorMsg);
      }

      // Get default UI and append it to DOM.
      this.cameraViewContainer.current!.append(cameraView.getUIElement());

      // Create a `CaptureVisionRouter` instance and set `CameraEnhancer` instance as its image source.
      this.cvRouter = await CaptureVisionRouter.createInstance();
      if (this.isDestroyed) {
        throw Error(componentDestroyedErrorMsg);
      }
      this.cvRouter.setInput(this.cameraEnhancer);

      await this.cvRouter.initSettings(template);

      // Define a callback for results.
      this.cvRouter.addResultReceiver({
        onDecodedBarcodesReceived: (result) => {
          if (!result.barcodeResultItems.length) return;

          let _resultText = "";
          console.log(result);
          for (let item of result.barcodeResultItems) {
            _resultText += `${item.formatString}: ${item.text}\n\n`;
          }
          this.setState({ resultText: _resultText });
        },
      });

      // Filter out unchecked and duplicate results.
      const filter = new MultiFrameResultCrossFilter();
      // Filter out unchecked barcodes.
      filter.enableResultCrossVerification("barcode", true);
      // Filter out duplicate barcodes within 3 seconds.
      filter.enableResultDeduplication("barcode", true);
      await this.cvRouter.addResultFilter(filter);
      if (this.isDestroyed) {
        throw Error(componentDestroyedErrorMsg);
      }

      // Hide camera and resolution dropdowns before opening.
      let parentElement = cameraView.getUIElement().shadowRoot;
      if (!!parentElement) {
        parentElement.querySelectorAll("select").forEach((select) => {
          select.setAttribute("style", "display: none !important;");
        });
      }

      // Open camera and start scanning single barcode.
      await this.cameraEnhancer.open();

      // Creates a box region in the UI which will be scanned. Area outside the box is ignored.
      const region = {
        x: 15,
        y: 40,
        width: 70,
        height: 20,
        isMeasuredInPercentage: true,
      };

      // Set the scan region after camera enhancer has been opened.
      this.cameraEnhancer.setScanRegion(region);

      /*** Debugging scan region now showing up on iOS. ***/
      const scanRegion = this.cameraEnhancer.getScanRegion();
      console.log("~ Current scan region object: ", JSON.stringify(scanRegion, null, 2));

      // Pull current resolution settings after camera has opened.
      const currentCameraSettings = this.cameraEnhancer.getVideoSettings();
      console.log(currentCameraSettings);

      // // Type assertion: Assert that currentCameraSettings.video has the expected structure
      // await this.cameraEnhancer.setResolution({
      //   width: (currentCameraSettings.video as { width: { ideal: number } }).width?.ideal,
      //   height: (currentCameraSettings.video as { height: { ideal: number } }).height?.ideal,
      // });

      cameraView.setScanLaserVisible(true);

      if (this.isDestroyed) {
        throw Error(componentDestroyedErrorMsg);
      }
      await this.cvRouter.startCapturing("ReadVINBarcode");
      if (this.isDestroyed) {
        throw Error(componentDestroyedErrorMsg);
      }
    } catch (ex: any) {
      if ((ex as Error)?.message === componentDestroyedErrorMsg) {
        console.log(componentDestroyedErrorMsg);
      } else {
        let errMsg = ex.message || ex;
        console.error(errMsg);
        alert(errMsg);
      }
    }

    // Resolve pInit promise once initialization is complete.
    this.resolveInit!();
  }

  async componentWillUnmount() {
    this.isDestroyed = true;
    try {
      // Wait for the pInit to complete before disposing resources.
      await this.pInit;
      this.cvRouter?.dispose();
      this.cameraEnhancer?.dispose();
    } catch (_) {}
  }

  shouldComponentUpdate() {
    // Never update UI after mount, sdk use native way to bind event, update will remove it.
    return false;
  }

  render() {
    return (
      <div>
        <div ref={this.cameraViewContainer} style={{ width: "100%", height: "70vh" }}></div>
        <br />
        Results:
        <div className="results">{this.state.resultText}</div>
      </div>
    );
  }
}

export default VideoCapture;
