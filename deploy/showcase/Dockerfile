FROM wanderwise-gpu:20260914-latency
USER 0
# Retain the verified NVIDIA EGL/DRI3 probe and framebuffer startup, without a
# streaming encoder, incoming input channel, or the existing cloud profile.
RUN rm -rf /etc/service/selkies /etc/service/coturn /home/ubuntu/wanderwise-profile \
    && sed -i 's/8192x4096x24/1920x1080x24/g' /etc/service/xvfb/run
COPY --chown=1000:1000 run /etc/service/wanderwise/run
COPY --chown=1000:1000 origin.py user.js /opt/showcase/
COPY policies.json /usr/lib/firefox/distribution/policies.json
RUN chmod 755 /etc/service/wanderwise/run
USER 1000
ENV DISPLAY=:30 START_LXQT=false
ENV SELKIES_MANUAL_WIDTH=1920 SELKIES_MANUAL_HEIGHT=1080 SELKIES_FRAMERATE=30
ENV SELKIES_MICROPHONE_ENABLED=false SELKIES_WEBCAM_ENABLED=false
HEALTHCHECK NONE
