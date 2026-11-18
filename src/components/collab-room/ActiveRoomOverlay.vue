<script setup lang="ts">
import LeftRoomNotice from './LeftRoomNotice.vue'
import RoomScreen from './RoomScreen.vue'
import { useRoomActions } from './useRoomActions'

/** The active room tab's screen while its document is on the way, or the note after leaving. */
const room = useRoomActions()
</script>

<template>
  <RoomScreen
    v-if="room.pendingStatus.value"
    :status="room.pendingStatus.value"
    :sender="room.sender.value"
    :others-waiting="room.othersWaiting.value"
    :name="room.state.value.localName"
    :link="room.shareLink.value"
    :desktop-link="room.desktopLink.value"
    :downloadURL="room.downloadURL.value"
    @leave="room.leave"
    @rename="room.rename"
  />
  <LeftRoomNotice v-else-if="room.leftRoom.value" @dismiss="room.dismissLeftRoomNote" />
</template>
