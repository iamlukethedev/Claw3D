"use client";

import { memo, Suspense, useMemo } from "react";
import type { AssetResolver } from "@claw3d/visual-contract";
import type { FurnitureItem } from "@/features/retro-office/core/types";
import {
  FurnitureModel as GenericFurnitureModel,
  InstancedFurnitureItems as InstancedFurnitureItemsModel,
} from "@/features/retro-office/objects/furniture";
import {
  DishwasherModel as KitchenDishwasherModel,
  MicrowaveModel as KitchenMicrowaveModel,
  SinkModel as KitchenSinkModel,
  StoveModel as KitchenStoveModel,
  VendingMachineModel as KitchenVendingMachineModel,
  WallCabinetModel as KitchenWallCabinetModel,
} from "@/features/retro-office/objects/kitchen";
import {
  AtmMachineModel as InteractiveAtmMachineModel,
  DeviceRackModel as InteractiveDeviceRackModel,
  DumbbellRackModel as InteractiveDumbbellRackModel,
  ExerciseBikeModel as InteractiveExerciseBikeModel,
  KettlebellRackModel as InteractiveKettlebellRackModel,
  PingPongTableModel as MachinePingPongTableModel,
  PhoneBoothModel as InteractivePhoneBoothModel,
  PunchingBagModel as InteractivePunchingBagModel,
  QaTerminalModel as InteractiveQaTerminalModel,
  RowingMachineModel as InteractiveRowingMachineModel,
  ServerRackModel as InteractiveServerRackModel,
  ServerTerminalModel as InteractiveServerTerminalModel,
  SmsBoothModel as InteractiveSmsBoothModel,
  TestBenchModel as InteractiveTestBenchModel,
  TreadmillModel as InteractiveTreadmillModel,
  WeightBenchModel as InteractiveWeightBenchModel,
  YogaMatModel as InteractiveYogaMatModel,
} from "@/features/retro-office/objects/machines";
import {
  ClockModel as PrimitiveClockModel,
  DoorModel as PrimitiveDoorModel,
  InstancedWallSegmentsModel as PrimitiveInstancedWallSegmentsModel,
  KeyboardModel as PrimitiveKeyboardModel,
  MouseModel as PrimitiveMouseModel,
  MugModel as PrimitiveMugModel,
  RoundTableModel as PrimitiveRoundTableModel,
  TrashCanModel as PrimitiveTrashCanModel,
} from "@/features/retro-office/objects/primitives";

const NOOP_FURNITURE_UID_HANDLER = () => {};
const NOOP_FURNITURE_HANDLER = () => {};
export const ReadOnlyFurnitureClone = memo(function ReadOnlyFurnitureClone({
  furniture,
  assetResolver,
}: {
  furniture: FurnitureItem[];
  assetResolver: AssetResolver;
}) {
  const deskItems = useMemo(
    () => furniture.filter((item) => item.type === "desk_cubicle"),
    [furniture],
  );
  const chairItems = useMemo(
    () => furniture.filter((item) => item.type === "chair"),
    [furniture],
  );
  const wallItems = useMemo(
    () => furniture.filter((item) => item.type === "wall"),
    [furniture],
  );

  return (
    <Suspense fallback={null}>
      <PrimitiveInstancedWallSegmentsModel items={wallItems} />
      <InstancedFurnitureItemsModel itemType="desk_cubicle" items={deskItems} resolveAsset={assetResolver.resolve} />
      <InstancedFurnitureItemsModel itemType="chair" items={chairItems} resolveAsset={assetResolver.resolve} />
      {furniture.map((item) =>
        item.type === "wall" ||
        item.type === "desk_cubicle" ||
        item.type === "chair" ? null : item.type === "door" ? (
          <PrimitiveDoorModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "round_table" ? (
          <PrimitiveRoundTableModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "keyboard" ? (
          <PrimitiveKeyboardModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "mouse" ? (
          <PrimitiveMouseModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "trash" ? (
          <PrimitiveTrashCanModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "mug" ? (
          <PrimitiveMugModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "clock" ? (
          <PrimitiveClockModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "atm" ? (
          <InteractiveAtmMachineModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "sms_booth" ? (
          <InteractiveSmsBoothModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            doorOpen={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "phone_booth" ? (
          <InteractivePhoneBoothModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            doorOpen={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "server_rack" ? (
          <InteractiveServerRackModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "server_terminal" ? (
          <InteractiveServerTerminalModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "vending" ? (
          <KitchenVendingMachineModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "sink" ? (
          <KitchenSinkModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "dishwasher" ? (
          <KitchenDishwasherModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "pingpong" ? (
          <MachinePingPongTableModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "qa_terminal" ? (
          <InteractiveQaTerminalModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "device_rack" ? (
          <InteractiveDeviceRackModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "test_bench" ? (
          <InteractiveTestBenchModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "treadmill" ? (
          <InteractiveTreadmillModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "weight_bench" ? (
          <InteractiveWeightBenchModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "dumbbell_rack" ? (
          <InteractiveDumbbellRackModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "exercise_bike" ? (
          <InteractiveExerciseBikeModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "rowing_machine" ? (
          <InteractiveRowingMachineModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "kettlebell_rack" ? (
          <InteractiveKettlebellRackModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "punching_bag" ? (
          <InteractivePunchingBagModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "yoga_mat" ? (
          <InteractiveYogaMatModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "stove" ? (
          <KitchenStoveModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "microwave" ? (
          <KitchenMicrowaveModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : item.type === "wall_cabinet" ? (
          <KitchenWallCabinetModel
            key={item._uid}
            item={item}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
          />
        ) : (
          <GenericFurnitureModel
            key={item._uid}
            item={item}
            isSelected={false}
            isHovered={false}
            editMode={false}
            onPointerDown={NOOP_FURNITURE_UID_HANDLER}
            onPointerOver={NOOP_FURNITURE_UID_HANDLER}
            onPointerOut={NOOP_FURNITURE_HANDLER}
            resolveAsset={assetResolver.resolve}
          />
        ),
      )}
    </Suspense>
  );
});
