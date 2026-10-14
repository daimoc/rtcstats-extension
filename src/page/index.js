import {
    WebSocketTrace,
    wrapEnumerateDevices,
    wrapGetUserMedia,
    wrapRTCPeerConnection,
    wrapSetSinkId,
} from '@rtcstats/rtcstats-js';
import {startTrace} from './trace.js';

startTrace(window, {
    WebSocketTrace,
    wrapEnumerateDevices,
    wrapGetUserMedia,
    wrapRTCPeerConnection,
    wrapSetSinkId,
});
