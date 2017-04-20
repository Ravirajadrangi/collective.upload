import './upload.less';
import './upload-icon.png';

import 'blueimp-tmpl/js/tmpl.js';
import 'blueimp-load-image/js/index.js';
import 'blueimp-canvas-to-blob/js/canvas-to-blob.js';
import 'blueimp-file-upload/js/jquery.iframe-transport.js';
import 'blueimp-file-upload/js/jquery.fileupload.js';
import 'blueimp-file-upload/js/jquery.fileupload-process.js';
import 'blueimp-file-upload/js/jquery.fileupload-image.js';
import 'blueimp-file-upload/js/jquery.fileupload-audio.js';
import 'blueimp-file-upload/js/jquery.fileupload-video.js';
import 'blueimp-file-upload/js/jquery.fileupload-validate.js';
import 'blueimp-file-upload/js/jquery.fileupload-ui.js';


class Upload {
  /**
   * Create file upload object and bind events
   * @constructor
   */
  constructor() {
    this.refresh();
    this.bind_events();
    if (this.$el.length > 0) {
      this.init_fileupload();
    }

    this.exif = {};
    this.exif.ImageDescription = 0x010E;
    this.exif.Artist = 0x013B;
  }

  /**
   * Refresh elements (needed when open modal)
   */
  refresh() {
    this.$el = $('.fileupload');
  }

  /**
   * Bind events
   */
  bind_events() {
    //overlay
    $('#plone-contentmenu-factories #multiple-files').prepOverlay({
      subtype: 'ajax',
      config: {
        onLoad: $.proxy(this.init_fileupload, this),
        onBeforeClose: this.before_close
      }
    });
    $(document).on('drop dragover', (e) => {
      // Prevent the default browser drop action:
      e.preventDefault();
    });
    $(document).on('drop', $.proxy(this.cross_site_drop, this));
    $(document).on('click', '.fileupload-buttonbar button.cancel', this.cancel_all);
    $(document).on('click', '.template-upload button.cancel', this.cancel_one);
  }

  /**
   * Initiate fileupload plugin
   */
  init_fileupload() {
    // Overlay requires to refresh element object
    this.refresh();
    let options = this.$el.prop('dataset');
    let files_re = new RegExp('(\\.|\/)('+options.extensions+')$', 'i');

    // Map tranlations options to object
    let translations = {};
    for (let k in options) {
      if (/^translations/.test(k)) {
        let newk = k.substring('translations'.length);
        newk = newk.charAt(0).toLowerCase() + newk.substring(1);
        translations[newk] = options[k];
      }
    }

    // Initialize the jQuery File Upload widget:
    this.$el.fileupload({
      sequentialUploads: true,
      singleFileUploads: true
    }).fileupload('option', {
      // Enable image resizing, except for Android and Opera,
      // which actually support image resizing, but fail to
      // send Blob objects via XHR requests:
      disableImageResize: /Android(?!.*Chrome)|Opera/.test(window.navigator.userAgent),
      maxFileSize: options.maxFileSize,
      acceptFileTypes: files_re,
      process: [
        {
          action: 'load',
          fileTypes: files_re,
          maxFileSize: options.maxFileSize
        },
        {
          action: 'resize',
          maxWidth: options.resizeMaxWidth,
          maxHeight: options.resizeMaxHeight
        },
        {
          action: 'save'
        }
      ],
      messages: translations
    }).on('fileuploadprocessdone', $.proxy(this.extract_metadata, this));
  }

  /**
   * Decode UTF8 string to Unicode
   * http://stackoverflow.com/a/13691499
   * @param {s} string - String to decode
   */
  decode_utf8(s) {
    return decodeURIComponent(escape(s));
  }

  /**
   * Extract image metadata using EXIF
   * @param {e} event - jQuery event variable
   * @param {data} data - Image data
   */
  extract_metadata(e, data) {
    if (typeof(data.exif) === 'undefined') {
      return;
    }
    let description = data.exif[this.exif.ImageDescription];
    if (typeof(description) !== 'undefined') {
      description = this.decode_utf8(description);
      $('.description', data.context[0]).val(description);
    }
    let artist = data.exif[this.exif.Artist];
    if (typeof(artist) !== 'undefined') {
      artist = this.decode_utf8(artist);
      $('.rights', data.context[0]).val(artist);
    }
  }

  /**
   * Cancell all files added
   * This callback is needed as workaround for old bootstrap version conflict
   * @param {e} event - jQuery event variable
   */
  cancel_all(e) {
    $('.template-upload').remove();
  }

  /**
   * Cancell one file added
   * This callback is needed as workaround for old bootstrap version conflict
   * @param {e} event - jQuery event variable
   */
  cancel_one(e) {
    $(e.target).parents('.template-upload').remove();
  }

  /**
   * Drop image from other website page
   * @param {e} event - jQuery event variable
   */
  cross_site_drop(e) {
    // Google Chrome
    let url = $(e.originalEvent.dataTransfer.getData('text/html')).filter('img').attr('src');
    // Firefox
    if (typeof(url) === 'undefined') {
      url = e.originalEvent.dataTransfer.getData('text/x-moz-url').split('\n')[0];
    }
    if (typeof(url) === 'undefined') {
      return;
    }
    // JavaScript URL parser: https://gist.github.com/jlong/2428561
    let parser = document.createElement('a');
    parser.href = location.href;
    parser.pathname = parser.pathname.replace(/\/folder_contents*|\/view*/, '');
    parser.pathname = parser.pathname + '/@@jsonimageserializer';
    $.ajax({
      url: parser.href,
      data: {url: url},
      context: this,
      success: (data) => {
        let img = document.createElement('img');
        img.name = data.name;
        img.onload = $.proxy((e) => {
          let canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          if (canvas.getContext && canvas.toBlob) {
            canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
            canvas.toBlob(function(that, name) {
              return (blob) => {
                blob.name = name;
                that.$el.fileupload('add', {files: [blob]});
              };
            }(this, img.name), 'image/jpeg');
          }
        }, this);
        img.src = data.data;
      }
    });
  }

  /**
   * Reload page when close overlay
   * @param {e} event - jQuery event variable
   */
  before_close(e) {
    location.reload();
  }
}


$(() => {
  new Upload();
});


module.exports = Upload;