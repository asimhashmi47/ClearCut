import { Config } from '@remotion/cli/config'

// Shares public/samples with the app, so the video shows the same real cutouts.
Config.setPublicDir('../public')
Config.setVideoImageFormat('jpeg')
Config.setCodec('h264')
