<script setup lang="ts">
import LeftRoomNotice from './LeftRoomNotice.vue'
import RoomScreen from './RoomScreen.vue'
import { useRoomActions } from './useRoomActions'

/** The active room tab's screen while its document is on the way, or the note after leaving. */
const room = useRoomActions()
</script>

<template>
  <RoomScreen
    v-if="room.pending.value && room.state.value.status"
    :status="room.state.value.status === 'joining' ? 'joining' : 'waiting'"
    :name="room.state.value.localName"
    :copied="room.copied.value"
    :name-hint="room.nameHint.value"
    :desktop-link="room.desktopLink.value"
    :downloadURL="room.downloadURL.value"
    @copy-link="room.copyLink"
    @leave="room.leave"
    @rename="room.rename"
  />
  <LeftRoomNotice v-else-if="room.leftRoom.value" @dismiss="room.dismissLeftRoomNote" />
</template>
