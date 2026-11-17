import {
  BellRinging,
  Browser,
  CashRegister,
  Car,
  ChefHat,
  CookingPot,
  CreditCard,
  DeviceMobile,
  DeviceMobileSpeaker,
  DeviceTablet,
  Fingerprint,
  AddressBook,
  Monitor,
  MonitorPlay,
  Moped,
  PhoneCall,
  QrCode,
  Queue,
  Scales,
  Television,
  Warehouse,
  type Icon,
  type IconWeight,
} from '@phosphor-icons/react'
import type { AppId, IntegrationGroup } from '../data/apps'

const APP_ICONS: Record<AppId, Icon> = {
  pos: CashRegister,
  pos_pro: Monitor,
  pos_v1: CashRegister,
  pos_v2: CashRegister,
  pos_v3: CashRegister,
  pos_v3_web: CashRegister,
  pos_mobile: DeviceMobile,
  kds: CookingPot,
  kds_v2: CookingPot,
  kitchen_monitoring: ChefHat,
  customer_display: MonitorPlay,
  drive_thru: Car,
  screen_menu: Television,
  kiosk: DeviceTablet,
  customer_queuing: Queue,
  qr_ringer: BellRinging,
  table_qr: QrCode,
  web_app: Browser,
  mobile_app: DeviceMobileSpeaker,
  delivery_app: Moped,
  stock: Warehouse,
  attendance: Fingerprint,
}

export function AppGlyph({ id, size = 28, weight = 'duotone' }: { id: AppId; size?: number; weight?: IconWeight }) {
  const Glyph = APP_ICONS[id]
  return <Glyph size={size} weight={weight} aria-hidden />
}

const GROUP_ICONS: Record<IntegrationGroup, Icon> = {
  delivery: Moped,
  payments: CreditCard,
  crm: AddressBook,
  calling: PhoneCall,
  scales: Scales,
}

export function IntegrationGlyph({ group, size = 18 }: { group: IntegrationGroup; size?: number }) {
  const Glyph = GROUP_ICONS[group]
  return <Glyph size={size} weight="bold" aria-hidden />
}
