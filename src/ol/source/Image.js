/**
 * @module ol/source/Image
 */
import {ENABLE_RASTER_REPROJECTION} from '../reproj/common.js';

import ImageState from '../ImageState.js';
import {linearFindNearest} from '../array.js';
import Event from '../events/Event.js';
import {equals} from '../extent.js';
import {equivalent} from '../proj.js';
import ReprojImage from '../reproj/Image.js';
import Source from '../source/Source.js';


/**
 * @enum {string}
 */
const ImageSourceEventType = {

  /**
   * Triggered when an image starts loading.
   * @event ol/source/Image~ImageSourceEvent#imageloadstart
   * @api
   */
  IMAGELOADSTART: 'imageloadstart',

  /**
   * Triggered when an image finishes loading.
   * @event ol/source/Image~ImageSourceEvent#imageloadend
   * @api
   */
  IMAGELOADEND: 'imageloadend',

  /**
   * Triggered if image loading results in an error.
   * @event ol/source/Image~ImageSourceEvent#imageloaderror
   * @api
   */
  IMAGELOADERROR: 'imageloaderror'

};


/**
 * @classdesc
 * Events emitted by {@link module:ol/source/Image~ImageSource} instances are instances of this
 * type.
 */
class ImageSourceEvent extends Event {
  /**
   * @param {string} type Type.
   * @param {import("../Image.js").default} image The image.
   */
  constructor(type, image) {

    super(type);

    /**
     * The image related to the event.
     * @type {import("../Image.js").default}
     * @api
     */
    this.image = image;

  }

}


/**
 * @typedef {Object} Options
 * @property {import("./Source.js").AttributionLike} [attributions]
 * @property {import("../proj.js").ProjectionLike} projection
 * @property {Array<number>} [resolutions]
 * @property {import("./State.js").default} [state]
 */


/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for sources providing a single image.
 * @api
 */
class ImageSource extends Source {
  /**
   * @param {Options} options Single image source options.
   */
  constructor(options) {
    super({
      attributions: options.attributions,
      projection: options.projection,
      state: options.state
    });

    /**
     * @private
     * @type {Array<number>}
     */
    this.resolutions_ = options.resolutions !== undefined ?
      options.resolutions : null;


    /**
     * @private
     * @type {import("../reproj/Image.js").default}
     */
    this.reprojectedImage_ = null;


    /**
     * @private
     * @type {number}
     */
    this.reprojectedRevision_ = 0;
  }

  /**
   * @return {Array<number>} Resolutions.
   * @override
   */
  getResolutions() {
    return this.resolutions_;
  }

  /**
   * @protected
   * @param {number} resolution Resolution.
   * @return {number} Resolution.
   */
  findNearestResolution(resolution) {
    if (this.resolutions_) {
      const idx = linearFindNearest(this.resolutions_, resolution, 0);
      resolution = this.resolutions_[idx];
    }
    return resolution;
  }

  /**
   * @param {import("../extent.js").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection.js").default} projection Projection.
   * @return {import("../ImageBase.js").default} Single image.
   */
  getImage(extent, resolution, pixelRatio, projection) {
    const sourceProjection = this.getProjection();
    if (!ENABLE_RASTER_REPROJECTION ||
        !sourceProjection ||
        !projection ||
        equivalent(sourceProjection, projection)) {
      if (sourceProjection) {
        projection = sourceProjection;
      }
      return this.getImageInternal(extent, resolution, pixelRatio, projection);
    } else {
      if (this.reprojectedImage_) {
        if (this.reprojectedRevision_ == this.getRevision() &&
            equivalent(
              this.reprojectedImage_.getProjection(), projection) &&
            this.reprojectedImage_.getResolution() == resolution &&
            equals(this.reprojectedImage_.getExtent(), extent)) {
          return this.reprojectedImage_;
        }
        this.reprojectedImage_.dispose();
        this.reprojectedImage_ = null;
      }

      this.reprojectedImage_ = new ReprojImage(
        sourceProjection, projection, extent, resolution, pixelRatio,
        function(extent, resolution, pixelRatio) {
          return this.getImageInternal(extent, resolution,
            pixelRatio, sourceProjection);
        }.bind(this));
      this.reprojectedRevision_ = this.getRevision();

      return this.reprojectedImage_;
    }
  }

  /**
   * @abstract
   * @param {import("../extent.js").Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {import("../proj/Projection.js").default} projection Projection.
   * @return {import("../ImageBase.js").default} Single image.
   * @protected
   */
  getImageInternal(extent, resolution, pixelRatio, projection) {}

  /**
   * Handle image change events.
   * @param {import("../events/Event.js").default} event Event.
   * @protected
   */
  handleImageChange(event) {
    const image = /** @type {import("../Image.js").default} */ (event.target);
    switch (image.getState()) {
      case ImageState.LOADING:
        this.loading = true;
        this.dispatchEvent(
          new ImageSourceEvent(ImageSourceEventType.IMAGELOADSTART,
            image));
        break;
      case ImageState.LOADED:
        this.loading = false;
        this.dispatchEvent(
          new ImageSourceEvent(ImageSourceEventType.IMAGELOADEND,
            image));
        break;
      case ImageState.ERROR:
        this.loading = false;
        this.dispatchEvent(
          new ImageSourceEvent(ImageSourceEventType.IMAGELOADERROR,
            image));
        break;
      default:
        // pass
    }
  }
}


/**
 * Default image load function for image sources that use import("../Image.js").Image image
 * instances.
 * @param {import("../Image.js").default} image Image.
 * @param {string} src Source.
 */
export function defaultImageLoadFunction(image, src) {
  /** @type {HTMLImageElement|HTMLVideoElement} */ (image.getImage()).src = src;
}


export default ImageSource;
