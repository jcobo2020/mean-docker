import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        children: [
            {
                path: '',
                loadChildren: () => import('app/feature/user/user.routes'),
            },
        ],
    },
    {
        path: 'clients',
        children: [
            {
                path: '',
                loadChildren: () =>
                    import('app/feature/clients/clients.routes'),
            },
        ],
    },
    {
        path: 'contacts',
        children: [
            {
                path: '',
                loadChildren: () =>
                    import('app/feature/contact/contact.routes'),
            },
        ],
    },
];
