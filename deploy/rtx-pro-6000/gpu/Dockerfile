FROM wanderwise-selkies-base:20260913
USER 0
COPY --chown=1000:1000 run /etc/service/wanderwise/run
COPY origin.py openbox.xml user.js cloud-status.js /opt/wanderwise/
RUN chmod 755 /etc/service/wanderwise/run && mkdir -p /home/ubuntu/wanderwise-profile && chown 1000:1000 /home/ubuntu/wanderwise-profile
USER 1000
ENV START_LXQT=false SELKIES_MODE=websockets SELKIES_ENABLE_HTTPS=false
ENV SELKIES_UNIX_SOCKET=/run/wanderwise/stream.sock
ENV SELKIES_ENCODER=h264enc SELKIES_FRAMERATE=60,30-60 SELKIES_VIDEO_BITRATE=8000,4000-16000
ENV SELKIES_VIDEO_STREAMING_MODE=true SELKIES_RATE_CONTROL_MODE=cbr
ENV SELKIES_MANUAL_WIDTH=1920 SELKIES_MANUAL_HEIGHT=1080
ENV SELKIES_ENABLE_CLIPBOARD=false SELKIES_FILE_TRANSFERS=none SELKIES_COMMAND_ENABLED=false
ENV SELKIES_MICROPHONE_ENABLED=false SELKIES_WEBCAM_ENABLED=false SELKIES_PRINTING_ENABLED=false
ENV SELKIES_ENABLE_SHARING=false SELKIES_ENABLE_COLLAB=false SELKIES_SECOND_SCREEN=false SELKIES_ENABLE_DUAL_MODE=false
ENV SELKIES_UI_TITLE="Wanderwise · RTX PRO 6000" SELKIES_UI_SHOW_LOGO=false
ENV SELKIES_UI_SIDEBAR_SHOW_APPS=false SELKIES_UI_SIDEBAR_SHOW_FILES=false SELKIES_UI_SIDEBAR_SHOW_CLIPBOARD=false
ENV SELKIES_UI_SIDEBAR_SHOW_SHARING=false SELKIES_UI_SIDEBAR_SHOW_WEBCAM=false
ENV SELKIES_RENDER_DRI=/dev/dri/renderD130 SELKIES_ENCODE_DRI=/dev/dri/renderD130
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD python3 -c "import socket,urllib.request; urllib.request.urlopen('http://127.0.0.1:4187/api/health',timeout=3).close(); s=socket.socket(socket.AF_UNIX); s.settimeout(2); s.connect('/run/wanderwise/stream.sock'); s.close()"
ENTRYPOINT ["/bin/bash", "-c", "umask 0007; exec /etc/container-entrypoint.sh"]
